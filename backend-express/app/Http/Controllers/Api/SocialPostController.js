'use strict';

const ScraperRepository = require('../../../Repositories/ScraperRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class SocialPostController {
    constructor() {
        this.repository = new ScraperRepository();
    }

    /**
     * @openapi
     * /social-posts:
     *   get:
     *     tags: [SocialPosts]
     *     summary: Danh sách tổng hợp social_posts (có metrics + sort)
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: sort_by
     *         schema:
     *           type: string
     *           enum: [hot_score, trend_score, discussion, interaction, sentiment]
     *       - in: query
     *         name: new_only
     *         schema: { type: boolean }
     *     responses:
     *       "200":
     *         description: OK
     */
    async list(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listSocialPosts(
                req.validatedData
            );
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                ResponseService.responseJsonPaginated(rows, page, per_page, count)
            );
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /social-posts/stats:
     *   get:
     *     tags: [SocialPosts]
     *     summary: Thống kê tổng / uptrend / downtrend
     *     security: []
     *     responses:
     *       "200":
     *         description: OK
     */
    async stats(req, res, next) {
        try {
            const data = await this.repository.getSocialPostStats(req.validatedData || {});
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /social-posts/dashboard:
     *   get:
     *     tags: [SocialPosts]
     *     summary: Dashboard home — stats + chart + ranking
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: sort_by
     *         schema:
     *           type: string
     *           enum: [hot_score, trend_score, discussion, interaction, sentiment]
     *       - in: query
     *         name: new_only
     *         schema: { type: boolean }
     *       - in: query
     *         name: chart_limit
     *         schema: { type: integer, minimum: 1, maximum: 20 }
     *     responses:
     *       "200":
     *         description: OK
     */
    async dashboard(req, res, next) {
        try {
            const data = await this.repository.getSocialPostsDashboard(req.validatedData);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = SocialPostController;
