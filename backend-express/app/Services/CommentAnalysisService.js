'use strict';

const CommentRepository = require('../Repositories/CommentRepository');
const GeminiService = require('../Services/GeminiService');
const {
    buildGeminiPayload,
    groupCommentsIntoAnalysisUnits,
    chunkAnalysisUnits,
    flattenAnalysisUnits,
    limitAnalysisUnits,
} = require('../Helpers/CommentHelper');
const geminiConfig = require('../../config/gemini');
const logger = require('../Logging/logger');

function normalizeLimitOptions(options = {}) {
    const hasLimits =
        options.max_comments != null ||
        options.max_replies != null ||
        options.maxComments != null ||
        options.maxReplies != null;
    if (!hasLimits) {
        return { applyLimits: false, maxComments: null, maxReplies: null };
    }

    const rawComments =
        options.max_comments != null ? options.max_comments : options.maxComments;
    const rawReplies =
        options.max_replies != null ? options.max_replies : options.maxReplies;

    const maxComments =
        rawComments != null && Number.isFinite(Number(rawComments))
            ? Math.max(1, Math.floor(Number(rawComments)))
            : null;
    const maxReplies =
        rawReplies != null && Number.isFinite(Number(rawReplies))
            ? Math.max(0, Math.floor(Number(rawReplies)))
            : null;

    return { applyLimits: true, maxComments, maxReplies };
}

class CommentAnalysisService {
    constructor() {
        this.commentRepository = new CommentRepository();
        this.geminiService = new GeminiService();
    }

    async analyzeContentBriefIfNeeded(scraperRunId) {
        const loaded = await this.commentRepository.loadRunWithComments(scraperRunId);
        if (!loaded?.run) {
            return { analyzed: false, reason: 'not_found', scraper_run_id: scraperRunId };
        }

        const run = loaded.run;
        const plain = typeof run.toJSON === 'function' ? run.toJSON() : { ...run };

        if (plain.content_brief_status === 'done' && plain.content_brief) {
            return {
                analyzed: false,
                reason: 'already_done',
                scraper_run_id: scraperRunId,
                content_brief: plain.content_brief,
            };
        }

        if (plain.content_brief_status === 'skipped') {
            return {
                analyzed: false,
                reason: 'skipped',
                scraper_run_id: scraperRunId,
            };
        }

        const title = String(plain.title || '').trim();
        const text = String(plain.text || '').trim();
        if (!title && !text) {
            await this.commentRepository.markContentBriefSkipped(scraperRunId);
            return {
                analyzed: false,
                reason: 'no_content',
                scraper_run_id: scraperRunId,
            };
        }

        await this.commentRepository.setContentBriefPending(scraperRunId);

        try {
            const { brief, model } = await this.geminiService.summarizeVideoContent({
                title,
                text,
                post_url: plain.post_url,
            });
            await this.commentRepository.applyContentBrief(scraperRunId, brief, 'done');
            return {
                analyzed: true,
                scraper_run_id: scraperRunId,
                model,
                content_brief: brief,
            };
        } catch (error) {
            await this.commentRepository.resetContentBriefPending(scraperRunId);
            throw error;
        }
    }

    /**
     * @param {number} scraperRunId
     * @param {{ max_comments?: number, max_replies?: number }|undefined} options
     *   — Chỉ path nút/API truyền limit; sau scrape không truyền = phân tích hết pending.
     */
    async analyzeScraperRunIfNeeded(scraperRunId, options = {}) {
        const limits = normalizeLimitOptions(options);
        const loaded = await this.commentRepository.loadRunWithComments(scraperRunId);
        if (!loaded || loaded.comments.length === 0) {
            return { analyzed: false, reason: 'no_comments', scraper_run_id: scraperRunId };
        }

        const needs = await this.commentRepository.needsAnalysis(scraperRunId);
        if (!needs) {
            return {
                analyzed: false,
                reason: 'already_done',
                scraper_run_id: scraperRunId,
                payload: await this.commentRepository.getAnalysisPayloadForEmail(scraperRunId),
            };
        }

        const pendingComments =
            await this.commentRepository.loadCommentsPendingAnalysis(scraperRunId);
        if (pendingComments.length === 0) {
            return {
                analyzed: false,
                reason: 'already_done',
                scraper_run_id: scraperRunId,
                payload: await this.commentRepository.getAnalysisPayloadForEmail(scraperRunId),
            };
        }

        const allUnits = groupCommentsIntoAnalysisUnits(pendingComments);
        const units = limits.applyLimits
            ? limitAnalysisUnits(allUnits, {
                  maxComments: limits.maxComments,
                  maxReplies: limits.maxReplies,
              })
            : allUnits;

        if (units.length === 0) {
            return {
                analyzed: false,
                reason: 'already_done',
                scraper_run_id: scraperRunId,
                max_comments: limits.maxComments,
                max_replies: limits.maxReplies,
                units_total_pending: allUnits.length,
                units_remaining_pending: allUnits.length,
                payload: await this.commentRepository.getAnalysisPayloadForEmail(scraperRunId),
            };
        }

        const chunks = chunkAnalysisUnits(
            units,
            geminiConfig.commentAnalysisChunkSize || 10
        );
        const sentThreadKeys = [];
        let model = null;
        let chunksProcessed = 0;
        let commentsSent = 0;

        for (const chunk of chunks) {
            for (const unit of chunk) {
                if (unit.type === 'thread' && unit.threadKey) {
                    sentThreadKeys.push(unit.threadKey);
                }
            }

            const chunkComments = flattenAnalysisUnits(chunk);
            commentsSent += chunkComments.length;
            const geminiPayload = buildGeminiPayload(loaded.run, chunkComments);
            const outcome = await this.geminiService.analyzeVideoComments(geminiPayload);
            model = outcome.model;
            await this.commentRepository.applyAnalysisResult(scraperRunId, outcome.result, {
                finalizePendingThreads: false,
            });
            chunksProcessed += 1;

            logger.info('[comment-analysis] chunk processed', {
                scraper_run_id: scraperRunId,
                chunk: chunksProcessed,
                chunks_total: chunks.length,
                comments_in_chunk: chunkComments.length,
            });
        }

        await this.commentRepository.finalizePendingThreads(scraperRunId, sentThreadKeys);

        const unitsRemaining = Math.max(0, allUnits.length - units.length);

        return {
            analyzed: true,
            scraper_run_id: scraperRunId,
            model,
            chunks_processed: chunksProcessed,
            comments_sent: commentsSent,
            units_analyzed: units.length,
            units_total_pending: allUnits.length,
            units_remaining_pending: unitsRemaining,
            max_comments: limits.applyLimits ? limits.maxComments : null,
            max_replies: limits.applyLimits ? limits.maxReplies : null,
            payload: await this.commentRepository.getAnalysisPayloadForEmail(scraperRunId),
        };
    }

    /**
     * Content brief (nếu chưa) + phân tích comment pending (bỏ qua đã done).
     * options.max_comments / max_replies — chỉ truyền từ nút UI / CommentAnalysisJob.
     */
    async analyzePostIfNeeded(scraperRunId, options = {}) {
        const content_brief = await this.analyzeContentBriefIfNeeded(scraperRunId);
        const comments_analysis = await this.analyzeScraperRunIfNeeded(
            scraperRunId,
            options
        );
        return { scraper_run_id: scraperRunId, content_brief, comments_analysis };
    }

    /**
     * Sau scrape: không làm fail luồng cào nếu Gemini lỗi.
     */
    async analyzePostAfterScrape(scraperRunId) {
        try {
            return await this.analyzePostIfNeeded(scraperRunId);
        } catch (error) {
            logger.warn('[comment-analysis] Gemini after scrape failed', {
                scraper_run_id: scraperRunId,
                error: error.message,
            });
            return {
                scraper_run_id: scraperRunId,
                analyzed: false,
                reason: 'error',
                error: error.message,
            };
        }
    }


    /**
     * Sau khi cào xong 1 kênh: AI tuần tự từng scraper_run.
     * stopOnError=true → dừng AI kênh này khi Gemini lỗi, không rethrow (scrape kênh sau vẫn chạy).
     */
    async analyzeRunsAfterChannelScrape(runIds = [], { stopOnError = true } = {}) {
        const ids = [...new Set((runIds || []).map(Number).filter((n) => n > 0))];
        const summary = {
            ai_briefs_analyzed: 0,
            ai_comments_analyzed: 0,
            ai_skipped: 0,
            ai_aborted: false,
            ai_error: null,
            processed: 0,
        };

        for (const runId of ids) {
            try {
                const ai = await this.analyzePostIfNeeded(runId);
                summary.processed += 1;
                if (ai?.content_brief?.analyzed) summary.ai_briefs_analyzed += 1;
                if (ai?.comments_analysis?.analyzed) summary.ai_comments_analyzed += 1;
                else if (ai?.comments_analysis?.reason === 'already_done') {
                    summary.ai_skipped += 1;
                }
            } catch (error) {
                logger.warn('[comment-analysis] AI aborted for channel run', {
                    scraper_run_id: runId,
                    error: error.message,
                });
                summary.ai_aborted = true;
                summary.ai_error = error.message;
                if (stopOnError) break;
            }
        }

        return summary;
    }

    async analyzeSubject(subjectId, { runIds, date_from, date_to, limit } = {}) {
        let runs;
        if (Array.isArray(runIds) && runIds.length > 0) {
            runs = await this.commentRepository.loadRunsByIds(runIds);
        } else {
            runs = await this.commentRepository.listTopRunsForSubject(subjectId, {
                limit: limit ?? 3,
                date_from,
                date_to,
            });
        }

        const videos = [];
        let analyzedCount = 0;
        let skippedCount = 0;
        let contentBriefsAnalyzed = 0;

        for (const run of runs) {
            const briefOutcome = await this.analyzeContentBriefIfNeeded(run.id);
            if (briefOutcome.analyzed) contentBriefsAnalyzed += 1;

            let outcome = await this.analyzeScraperRunIfNeeded(run.id);
            if (outcome.analyzed) analyzedCount += 1;
            else skippedCount += 1;

            let payload = outcome.payload;
            if (!payload) {
                payload = await this.commentRepository.getAnalysisPayloadForEmail(run.id);
            }
            if (payload) videos.push(payload);
        }

        return {
            subject_id: subjectId,
            videos_analyzed: analyzedCount,
            videos_skipped: skippedCount,
            content_briefs_analyzed: contentBriefsAnalyzed,
            videos,
        };
    }
}

module.exports = CommentAnalysisService;
