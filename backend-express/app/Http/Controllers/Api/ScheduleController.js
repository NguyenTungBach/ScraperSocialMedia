'use strict';

const GeneralScheduleService = require('../../../Services/GeneralScheduleService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class ScheduleController {
    constructor() {
        this.service = new GeneralScheduleService();
    }

    /**
     * @openapi
     * /schedules:
     *   get:
     *     tags: [Schedules]
     *     summary: Danh sách lịch cron (admin)
     *     description: |
     *       Trả paginated `general_schedules` + `allowed_commands` (các `npm run app:*` hợp lệ).
     *       Process `${PM2_API_NAME}-schedule` reload từ DB mỗi `SCHEDULE_RELOAD_MS`.
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1, default: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
     *       - in: query
     *         name: q
     *         schema: { type: string }
     *         description: Tìm theo name / command
     *       - in: query
     *         name: enabled
     *         schema:
     *           oneOf:
     *             - type: boolean
     *             - type: string
     *               enum: ["true", "false", "1", "0"]
     *     responses:
     *       "200":
     *         description: OK (+ allowed_commands)
     */
    async list(req, res, next) {
        try {
            const { rows, count, page, per_page, allowed_commands } = await this.service.list(
                req.validatedData || {}
            );
            const data = ResponseService.responseJsonPaginated(rows, page, per_page, count);
            data.allowed_commands = allowed_commands;
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /schedules:
     *   post:
     *     tags: [Schedules]
     *     summary: Tạo lịch (admin)
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, cron_expression, command]
     *             properties:
     *               name:
     *                 type: string
     *                 example: Snapshot metrics 5h
     *               cron_expression:
     *                 type: string
     *                 description: Cron 5-field (node-cron), timezone APP_TIMEZONE
     *                 example: "0 5 * * *"
     *               command:
     *                 type: string
     *                 description: Phải là `npm run app:*` có trong package.json
     *                 example: "npm run app:metric-snapshot"
     *               enabled:
     *                 type: boolean
     *                 default: true
     *     responses:
     *       "201":
     *         description: Created
     *       "422":
     *         description: Invalid cron / command
     */
    async store(req, res, next) {
        try {
            const row = await this.service.create(req.validatedData);
            return ResponseService.responseJsonCreated(res, row, 'Schedule created');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /schedules/{id}:
     *   put:
     *     tags: [Schedules]
     *     summary: Cập nhật lịch (admin)
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
     *               cron_expression: { type: string }
     *               command: { type: string, example: "npm run app:alert-gmail" }
     *               enabled: { type: boolean }
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Không tìm thấy
     *       "422":
     *         description: Validation error
     */
    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const row = await this.service.update(id, req.validatedData || {});
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row, 'Schedule updated');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /schedules/{id}:
     *   delete:
     *     tags: [Schedules]
     *     summary: Xóa lịch (admin)
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
     */
    async destroy(req, res, next) {
        try {
            const id = Number(req.params.id);
            const result = await this.service.destroy(id);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result, 'Schedule deleted');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /schedules/{id}/run:
     *   post:
     *     tags: [Schedules]
     *     summary: Chạy ngay 1 lịch (admin) — spawn `npm run app:*`
     *     description: |
     *       Spawn command không `await` trong API process (giống schedule worker).
     *       Cập nhật `last_status` / `last_run_at` trên bản ghi.
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       "200":
     *         description: Schedule started
     *       "404":
     *         description: Không tìm thấy
     *       "409":
     *         description: Đang chạy
     */
    async runNow(req, res, next) {
        try {
            const id = Number(req.params.id);
            const row = await this.service.runNow(id);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row, 'Schedule started');
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = ScheduleController;
