'use strict';

const createError = require('http-errors');
const ScraperRepository = require('../Repositories/ScraperRepository');
const CommentAnalysisService = require('./CommentAnalysisService');
const MailService = require('./MailService');
const { roundScore } = require('../Helpers/PostScoreHelper');
const { buildAlertEmail, buildNoAlertEmail } = require('../Helpers/EmailAlertBuilder');
const geminiConfig = require('../../config/gemini');
const mailConfig = require('../../config/mail');

function groupAlertPostsBySubject(posts = []) {
    const map = new Map();
    for (const post of posts) {
        const subjectId = Number(post.subject_id);
        if (!map.has(subjectId)) {
            map.set(subjectId, {
                subject_id: subjectId,
                subject: post.subject,
                posts: [],
            });
        }
        map.get(subjectId).posts.push(post);
    }
    return map;
}

class AlertService {
    constructor() {
        this.repository = new ScraperRepository();
        this.commentAnalysisService = new CommentAnalysisService();
    }

    /**
     * @param {{ subject_id?: number|null, to?: string|null, bcc?: string[]|null }} options
     */
    async runGmailAlert({ subject_id = null, to = null, bcc: bodyBcc = null } = {}) {
        const recipient = (to || mailConfig.mailMain || '').trim();
        if (!recipient) {
            throw createError(422, 'Missing recipient. Set MAIL_MAIN or pass body.to');
        }
        if (!mailConfig.isTransportReady()) {
            throw createError(422, 'Mail transport is not configured');
        }

        const bccRaw = [...mailConfig.alertBcc, ...(Array.isArray(bodyBcc) ? bodyBcc : [])];
        const bccSeen = new Set();
        const bcc = [];
        const recipientLower = recipient.toLowerCase();
        for (const email of bccRaw) {
            const trimmed = String(email || '').trim();
            const key = trimmed.toLowerCase();
            if (!trimmed || key === recipientLower || bccSeen.has(key)) continue;
            bccSeen.add(key);
            bcc.push(trimmed);
        }

        const thresholds = {
            hot: geminiConfig.alertHotThreshold,
            trend: geminiConfig.alertTrendThreshold,
        };

        const alertPosts = await this.repository.listAlertPosts({ subject_id });
        if (alertPosts.length === 0) {
            const html = buildNoAlertEmail({ thresholds, subject_id });
            const ok = await MailService.sendHtml({
                to: recipient,
                subject: '[Alert] Không có đối tượng vượt ngưỡng hot/trend',
                html,
                bcc: bcc.length ? bcc : undefined,
            });

            if (!ok) {
                throw createError(500, 'Failed to send Gmail');
            }

            return {
                sent: true,
                reason: 'no_candidates_over_threshold',
                to: recipient,
                bcc_count: bcc.length,
                count: 0,
                thresholds,
            };
        }

        const geminiDisabled = !geminiConfig.enabled || !geminiConfig.apiKey;
        const subjectGroups = groupAlertPostsBySubject(alertPosts);
        const subjectAnalyses = [];
        let videosAnalyzed = 0;
        let commentsVideos = 0;
        let contentBriefsAnalyzed = 0;
        const topLimit = geminiConfig.alertTopPostsPerSubject;

        for (const group of subjectGroups.values()) {
            const sorted = [...group.posts].sort((a, b) => b.hot_score - a.hot_score);
            const topPosts = sorted.slice(0, topLimit);
            const runIds = topPosts.map((p) => p.id);
            const subjectId = group.subject_id;

            const analysis = await this.commentAnalysisService.analyzeSubject(subjectId, {
                runIds,
            });
            videosAnalyzed += analysis.videos_analyzed || 0;
            commentsVideos += analysis.videos?.length || 0;
            contentBriefsAnalyzed += analysis.content_briefs_analyzed || 0;

            subjectAnalyses.push({
                subjectName: group.subject?.name || `#${subjectId}`,
                subjectStats: {
                    hot_score: sorted[0]?.hot_score ?? 0,
                    trend_score: Math.max(...sorted.map((p) => p.trend_score ?? 0)),
                },
                videos: analysis.videos || [],
                geminiDisabled,
            });
        }

        const html = buildAlertEmail({
            alertPosts,
            subjectAnalyses,
            thresholds,
            geminiDisabled,
        });

        const subjectCount = subjectGroups.size;
        const ok = await MailService.sendHtml({
            to: recipient,
            subject: `[Alert] ${alertPosts.length} bài viết (${subjectCount} subject) vượt ngưỡng hot/trend`,
            html,
            bcc: bcc.length ? bcc : undefined,
        });

        if (!ok) {
            throw createError(500, 'Failed to send Gmail');
        }

        return {
            sent: true,
            to: recipient,
            bcc_count: bcc.length,
            count: alertPosts.length,
            subject_count: subjectCount,
            thresholds,
            analysis: {
                subjects_analyzed: subjectAnalyses.length,
                videos_analyzed: videosAnalyzed,
                videos_with_data: commentsVideos,
                content_briefs_analyzed: contentBriefsAnalyzed,
                gemini_disabled: geminiDisabled,
            },
            posts: alertPosts.map((row) => ({
                scraper_run_id: row.id,
                subject_id: row.subject_id,
                subject_name: row.subject?.name,
                platform: row.platform,
                title: row.title,
                hot_score: roundScore(row.hot_score),
                trend_score: roundScore(row.trend_score),
            })),
        };
    }
}

module.exports = AlertService;
