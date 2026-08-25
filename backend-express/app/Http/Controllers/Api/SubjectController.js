'use strict';

const createError = require('http-errors');
const GeminiService = require('../../../Services/GeminiService');
const ScraperRepository = require('../../../Repositories/ScraperRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class SubjectController {
    constructor() {
        this.geminiService = new GeminiService();
        this.repository = new ScraperRepository();
    }

    /**
     * @openapi
     * /subjects/discover:
     *   post:
     *     tags: [Subjects]
     *     summary: Gọi Gemini lấy danh sách subjects và lưu DB
     *     description: |
     *       Prompt mặc định lấy tên người nổi tiếng / giang hồ mạng / phát ngôn gây bão
     *       liên quan an ninh trật tự VN trong 4 tháng gần đây.
     *       Response Gemini kỳ vọng:
     *       `{"data":[{"name":"...","nick_name":"..."}]}`
     *       Map DB: `name` → `subjects.name`, `nick_name` → `subjects.normalized_name`.
     *     security: []
     *     responses:
     *       "200":
     *         description: OK
     *       "503":
     *         description: Gemini disabled hoặc thiếu API key
     */
    async discover(req, res, next) {
        try {
            const { data, model } = await this.geminiService.discoverSubjects();
            const result = await this.repository.upsertSubjectsFromNames(data, 'gemini');

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                model,
                gemini: { data },
                inserted_count: result.inserted.length,
                existing_count: result.existing.length,
                subjects: result.all,
            });
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /subjects:
     *   get:
     *     tags: [Subjects]
     *     summary: Danh sách subjects
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: status
     *         schema: { type: string, example: active }
     *     responses:
     *       "200":
     *         description: OK
     */
    async list(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listSubjects(req.validatedData);
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
     * /subjects/{id}:
     *   get:
     *     tags: [Subjects]
     *     summary: Chi tiết subject + tổng hợp + danh sách bài viết liên quan (đầy đủ metrics)
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
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
     *           enum: [posted_at, likes, comments, shares, interaction, hot_score]
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Không tìm thấy
     */
    async show(req, res, next) {
        try {
            const detail = await this.repository.getSubjectDetail(req.params.id, req.validatedData || {});
            if (!detail) {
                throw createError(404, 'Subject not found');
            }
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, detail);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = SubjectController;
