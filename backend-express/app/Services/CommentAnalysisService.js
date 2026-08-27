'use strict';

const CommentRepository = require('../Repositories/CommentRepository');
const GeminiService = require('../Services/GeminiService');
const { buildGeminiPayload } = require('../Helpers/CommentHelper');
const geminiConfig = require('../../config/gemini');

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

        if (!geminiConfig.enabled || !geminiConfig.apiKey) {
            return {
                analyzed: false,
                reason: 'gemini_disabled',
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

    async analyzeScraperRunIfNeeded(scraperRunId) {
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

        if (!geminiConfig.enabled || !geminiConfig.apiKey) {
            return { analyzed: false, reason: 'gemini_disabled', scraper_run_id: scraperRunId };
        }

        const geminiPayload = buildGeminiPayload(loaded.run, loaded.comments);
        const { result, model } = await this.geminiService.analyzeVideoComments(geminiPayload);
        await this.commentRepository.applyAnalysisResult(scraperRunId, result);

        return {
            analyzed: true,
            scraper_run_id: scraperRunId,
            model,
            payload: await this.commentRepository.getAnalysisPayloadForEmail(scraperRunId),
        };
    }

    async analyzeSubject(subjectId, { date_from, date_to } = {}) {
        const runs = await this.commentRepository.listYoutubeRunsForSubject(subjectId, {
            limit: geminiConfig.alertTopVideosPerSubject,
            date_from,
            date_to,
        });

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
