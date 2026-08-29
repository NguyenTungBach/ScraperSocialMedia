'use strict';

const MetricSnapshotService = require('../../../Services/MetricSnapshotService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class SnapshotController {
    constructor() {
        this.service = new MetricSnapshotService();
    }

    /**
     * @openapi
     * /snapshots/run:
     *   post:
     *     tags: [Snapshots]
     *     summary: Chạy snapshot metrics (kênh ∈ subject_channels)
     *     security: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               force: { type: boolean, default: false }
     *               snapshot_date: { type: string, example: "2026-08-29" }
     *               channel_id: { type: integer, description: Chỉ snapshot 1 kênh }
     *               scraper_run_id: { type: integer, description: Chỉ snapshot 1 bài (+ refresh kênh) }
     *     responses:
     *       "200":
     *         description: OK hoặc needs_confirm
     */
    async run(req, res, next) {
        try {
            const body = req.body || {};
            const result = await this.service.run({
                force: Boolean(body.force),
                snapshot_date: body.snapshot_date || undefined,
                channel_id: body.channel_id != null ? Number(body.channel_id) : undefined,
                scraper_run_id:
                    body.scraper_run_id != null ? Number(body.scraper_run_id) : undefined,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/status:
     *   get:
     *     tags: [Snapshots]
     *     summary: Kiểm tra đã có snapshot ngày chưa
     *     security: []
     *     parameters:
     *       - in: query
     *         name: date
     *         schema: { type: string, example: today }
     *     responses:
     *       "200":
     *         description: OK
     */
    async status(req, res, next) {
        try {
            const result = await this.service.status(req.query.date || 'today');
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/channels/{id}:
     *   get:
     *     tags: [Snapshots]
     *     summary: Snapshot kênh (hôm nay + delta, hoặc series theo khoảng ngày)
     *     security: []
     */
    async channelDetail(req, res, next) {
        try {
            const result = await this.service.channelDetail(req.params.id, req.query);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/channels/{id}/top-posts:
     *   get:
     *     tags: [Snapshots]
     *     summary: Top bài theo hot_score/trend_score trong 1 ngày snapshot
     *     security: []
     */
    async channelTopPosts(req, res, next) {
        try {
            const result = await this.service.channelTopPosts(req.params.id, req.query);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/posts/{scraperRunId}:
     *   get:
     *     tags: [Snapshots]
     *     summary: Snapshot bài (hôm nay + delta, hoặc series)
     *     security: []
     */
    async postDetail(req, res, next) {
        try {
            const result = await this.service.postDetail(req.params.scraperRunId, req.query);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/posts/{scraperRunId}/top-comments:
     *   get:
     *     tags: [Snapshots]
     *     summary: Top 10 comment like đã đóng băng theo ngày
     *     security: []
     */
    async postTopComments(req, res, next) {
        try {
            const result = await this.service.postTopComments(
                req.params.scraperRunId,
                req.query
            );
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/channels/compare:
     *   get:
     *     tags: [Snapshots]
     *     summary: So sánh nhiều kênh theo khoảng ngày
     *     security: []
     */
    async compareChannels(req, res, next) {
        try {
            const result = await this.service.compareChannels(req.query);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/posts/compare:
     *   get:
     *     tags: [Snapshots]
     *     summary: So sánh nhiều bài theo khoảng ngày
     *     security: []
     */
    async comparePosts(req, res, next) {
        try {
            const result = await this.service.comparePosts(req.query);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /snapshots/posts/catalog:
     *   get:
     *     tags: [Snapshots]
     *     summary: Catalog bài (mọi kênh) để chọn so sánh
     *     security: []
     *     parameters:
     *       - in: query
     *         name: channel_id
     *         schema: { type: integer }
     *       - in: query
     *         name: q
     *         schema: { type: string }
     *       - in: query
     *         name: page
     *         schema: { type: integer }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer }
     */
    async catalogPosts(req, res, next) {
        try {
            const result = await this.service.catalogPosts(req.query);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = SnapshotController;
