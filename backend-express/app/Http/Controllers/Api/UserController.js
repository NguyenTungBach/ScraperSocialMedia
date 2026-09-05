'use strict';

const UserRepository = require('../../../Repositories/UserRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class UserController {
    constructor() {
        this.repository = new UserRepository();
    }

    /**
     * @openapi
     * /users:
     *   get:
     *     tags: [Users]
     *     summary: Danh sách users (admin)
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1, default: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
     *       - in: query
     *         name: q
     *         schema: { type: string }
     *         description: Tìm theo user_code / user_name
     *       - in: query
     *         name: role
     *         schema:
     *           type: string
     *           enum: [admin, member]
     *       - in: query
     *         name: status
     *         schema:
     *           type: integer
     *           enum: [1, 2]
     *         description: "1 = on, 2 = off"
     *     responses:
     *       "200":
     *         description: OK (paginated)
     *       "403":
     *         description: Không phải admin
     */
    async list(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listUsers(
                req.validatedData || {}
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
     * /users:
     *   post:
     *     tags: [Users]
     *     summary: Tạo user (admin)
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [user_code, user_name, password]
     *             properties:
     *               user_code:
     *                 type: string
     *                 pattern: "^\\d{1,15}$"
     *                 example: "1001"
     *               user_name:
     *                 type: string
     *                 maxLength: 20
     *                 example: "nguyen van a"
     *               password:
     *                 type: string
     *                 description: 8–16 ký tự, không khoảng trắng
     *                 example: "password1"
     *               role:
     *                 type: string
     *                 enum: [admin, member]
     *                 default: member
     *               status:
     *                 type: integer
     *                 enum: [1, 2]
     *                 default: 1
     *     responses:
     *       "201":
     *         description: Created
     *       "422":
     *         description: Validation error
     */
    async store(req, res, next) {
        try {
            const row = await this.repository.createUser(req.validatedData);
            return ResponseService.responseJsonCreated(res, row, 'User created');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /users/{id}:
     *   put:
     *     tags: [Users]
     *     summary: Cập nhật user (admin)
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
     *               user_code: { type: string, pattern: "^\\d{1,15}$" }
     *               user_name: { type: string, maxLength: 20 }
     *               password:
     *                 type: string
     *                 description: Để trống hoặc bỏ qua nếu không đổi
     *               role:
     *                 type: string
     *                 enum: [admin, member]
     *               status:
     *                 type: integer
     *                 enum: [1, 2]
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
            const row = await this.repository.updateUser(id, req.validatedData, {
                actorId: req.user?.id,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row, 'User updated');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /users/{id}:
     *   delete:
     *     tags: [Users]
     *     summary: Xóa user (admin)
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
            const result = await this.repository.deleteUser(id, {
                actorId: req.user?.id,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result, 'User deleted');
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = UserController;
