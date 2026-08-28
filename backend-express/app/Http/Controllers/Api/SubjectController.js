'use strict';

const createError = require('http-errors');
const GeminiService = require('../../../Services/GeminiService');
const ScraperRepository = require('../../../Repositories/ScraperRepository');
const ChannelRepository = require('../../../Repositories/ChannelRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class SubjectController {
    constructor() {
        this.geminiService = new GeminiService();
        this.repository = new ScraperRepository();
        this.channelRepository = new ChannelRepository();
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
     *     summary: Danh sách subjects (search + paginate)
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
     *       - in: query
     *         name: q
     *         schema: { type: string }
     *         description: Tìm theo name hoặc biệt danh (normalized_name)
     *       - in: query
     *         name: key_search
     *         schema: { type: string }
     *         description: Alias của q
     *       - in: query
     *         name: sort_by
     *         schema:
     *           type: string
     *           enum: [name, nickname, discussion, interaction, follow, sentiment, hot_score, trend_score, id]
     *       - in: query
     *         name: sort_dir
     *         schema:
     *           type: string
     *           enum: [asc, desc]
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
     * /subjects:
     *   post:
     *     tags: [Subjects]
     *     summary: Tạo đối tượng mới
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name]
     *             properties:
     *               name: { type: string }
     *               normalized_name: { type: string, nullable: true }
     *               item_type: { type: string, example: person }
     *               status: { type: string, example: active }
     *               source: { type: string, example: manual }
     *               channel_ids:
     *                 type: array
     *                 items: { type: integer, minimum: 1 }
     *                 description: Gắn kênh qua bảng `subject_channels`
     *                 example: [1, 2, 3]
     *     responses:
     *       "200":
     *         description: Created
     */
    async store(req, res, next) {
        try {
            const subject = await this.repository.createSubject(req.validatedData);
            return ResponseService.responseJsonCreated(res, subject, 'Subject created');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /subjects/{id}:
     *   put:
     *     tags: [Subjects]
     *     summary: Cập nhật đối tượng
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name: { type: string }
     *               normalized_name: { type: string, nullable: true }
     *               item_type: { type: string }
     *               status: { type: string }
     *               channel_ids:
     *                 type: array
     *                 items: { type: integer, minimum: 1 }
     *                 description: Thay thế toàn bộ kênh gắn với subject
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Không tìm thấy
     */
    async update(req, res, next) {
        try {
            const subject = await this.repository.updateSubject(req.params.id, req.validatedData);
            if (!subject) {
                throw createError(404, 'Subject not found');
            }
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, subject, 'Subject updated');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /subjects/{id}:
     *   delete:
     *     tags: [Subjects]
     *     summary: Xóa cứng đối tượng (chặn nếu còn subjects_scraper_runs)
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       "200":
     *         description: Deleted
     *       "404":
     *         description: Không tìm thấy
     *       "409":
     *         description: Đối tượng đang có bài liên kết
     */
    async destroy(req, res, next) {
        try {
            const result = await this.repository.deleteSubject(req.params.id);
            if (!result) {
                throw createError(404, 'Subject not found');
            }
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result, 'Subject deleted');
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
     *           enum: [posted_at, likes, comments, shares, interaction, hot_score, trend_score]
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

    /**
     * @openapi
     * /subjects/{id}/channels:
     *   post:
     *     tags: [Subjects]
     *     summary: Gắn thêm một kênh vào subject
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Subject ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [channel_id]
     *             properties:
     *               channel_id:
     *                 type: integer
     *                 minimum: 1
     *                 description: ID kênh trong bảng `channels`
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Subject hoặc channel không tồn tại
     */
    async attachChannel(req, res, next) {
        try {
            const result = await this.repository.attachSubjectChannel(
                req.params.id,
                req.validatedData.channel_id
            );
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                {
                    created: result.created,
                    link: result.link,
                    channel: result.channel,
                },
                result.created ? 'Channel attached' : 'Channel already attached'
            );
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /subjects/{id}/channels/{channelId}:
     *   delete:
     *     tags: [Subjects]
     *     summary: Gỡ kênh khỏi subject
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Subject ID
     *       - in: path
     *         name: channelId
     *         required: true
     *         schema: { type: integer }
     *         description: Channel ID
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Liên kết không tồn tại
     */
    async detachChannel(req, res, next) {
        try {
            const result = await this.repository.detachSubjectChannel(
                req.params.id,
                req.params.channelId
            );
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result, 'Channel detached');
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = SubjectController;
