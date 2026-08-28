/**
 * OpenAPI: map từ `backend/app/Http/Controllers/Api/AuthController.php` — dùng JSDoc `@openapi` (swagger-jsdoc).
 * Laravel OA dùng query cho một số endpoint; Express thực tế dùng JSON body (ghi trong description).
 *
 * Login + GET `/profile` trả thông tin từ bảng `users` (không load org nested).
 */
const AuthService = require('../../../Services/AuthService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');
const AuthRepository = require('../../../Repositories/AuthRepository');

const authRepository = new AuthRepository();

class AuthController {
    /**
     * @openapi
     * /auth/login:
     *   post:
     *     tags: [Auth]
     *     summary: User Login
     *     operationId: user_login
     *     description: |
     *       Laravel `@OA`: `mail_address`, `password` (query). Express đọc **JSON body** cùng tên field.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [mail_address, password]
     *             properties:
     *               mail_address: { type: string, example: "1okuridashi_hanoi@gmail.vn" }
     *               password: { type: string, example: "123456789CCk" }
     *     responses:
     *       "200":
     *         description: Gửi yêu cầu thành công
     *         content:
     *           application/json:
     *             example:
     *               {
     *                 code: 200,
     *                 data:
     *                   {
     *                     access_token: "Bearer ...",
     *                     profile:
     *                       {
     *                         id: 1,
     *                         login_id: 111111,
     *                         type: 4,
     *                         status: 2,
     *                         name_company_or_hro: "…",
     *                         company: { jobType: {}, job: {} },
     *                         hr_organization: { file: {}, country: {} },
     *                         support_organization: {}
     *                       }
     *                   }
     *               }
     *       "401":
     *         description: Đăng nhập thất bại
     *         content:
     *           application/json:
     *             example: { code: 401, message: "Login_id or password not correct" }
     */
    async login(req, res, next) {
        try {
            const userCode = req.body?.user_code;
            const password = req.body?.password;

            const result = await AuthService.loginUser(String(userCode), String(password));
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            if (error.message === 'Login failed' || error.message === 'Invalid credentials') {
                return ResponseService.responseJsonError(
                    res,
                    HTTP_STATUS.UNAUTHORIZED,
                    'Login failed',
                    null
                );
            }
            if (error.message === 'Account is not allowed to login') {
                return ResponseService.responseJsonError(
                    res,
                    HTTP_STATUS.UNAUTHORIZED,
                    'Account is not allowed to login',
                    null
                );
            }
            if (error.message === 'This account type cannot sign in here') {
                return ResponseService.responseJsonError(
                    res,
                    HTTP_STATUS.FORBIDDEN,
                    error.message,
                    null
                );
            }
            return next(error);
        }
    }

    /**
     * @openapi
     * /auth/forget-password:
     *   post:
     *     tags: [Auth]
     *     summary: Forget password
     *     operationId: forget_password
     *     description: Laravel `@OA` dùng query `mail_address`; Express dùng JSON body.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [mail_address]
     *             properties:
     *               mail_address: { type: string }
     *     responses:
     *       "200":
     *         description: Gửi yêu cầu thành công
     *         content:
     *           application/json:
     *             example: { code: 200, data: "Password reset URL has been sent to your email address" }
     */
    async forgetPassword(req, res, next) {
        try {
            const mailAddress = req.body?.mail_address;
            await authRepository.forgetPassword(String(mailAddress));
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                'Password reset URL has been sent to your email address'
            );
        } catch (error) {
            if (error.statusCode === 404) {
                return ResponseService.responseJsonError(res, HTTP_STATUS.NOT_FOUND, 'User not found', null);
            }
            if (error.statusCode === 501) {
                return ResponseService.responseJsonError(res, 501, error.message, null);
            }
            return next(error);
        }
    }

    /**
     * @openapi
     * /auth/password-reset:
     *   put:
     *     tags: [Auth]
     *     summary: Reset password bằng token email
     *     operationId: password_reset
     *     description: |
     *       Đặt mật khẩu mới sau khi nhận link/token từ `POST /auth/forget-password`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [token, mail_address, new_password, new_password_confirm]
     *             properties:
     *               token: { type: string, description: Token reset từ email }
     *               mail_address: { type: string, format: email }
     *               new_password: { type: string }
     *               new_password_confirm: { type: string }
     *     responses:
     *       "200":
     *         description: Đặt mật khẩu mới thành công
     *       "403":
     *         description: Token không hợp lệ / hết hạn
     *       "404":
     *         description: User không tồn tại
     */
    async resetPassword(req, res, next) {
        try {
            await authRepository.resetPassword(req.body || {});
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                'New password reset completed'
            );
        } catch (error) {
            if (error.statusCode === 501) {
                return ResponseService.responseJsonError(res, 501, error.message, null);
            }
            if (error.statusCode === 404) {
                return ResponseService.responseJsonError(res, HTTP_STATUS.NOT_FOUND, error.message, null);
            }
            if (error.statusCode === 403) {
                return ResponseService.responseJsonError(res, HTTP_STATUS.FORBIDDEN, error.message, null);
            }
            return next(error);
        }
    }

    /**
     * @openapi
     * /profile:
     *   get:
     *     tags: [Auth]
     *     summary: Get Profile
     *     operationId: user_profile
     *     security:
     *       - auth: []
     *     responses:
     *       "200":
     *         description: |
     *           User + `name_company_or_hro` + `company` (jobType, job) / `hr_organization` (file presigned, country) / `support_organization`
     *           — đồng bộ cấu trúc với `AuthRepository.fillNameCompanyOrHro` sau khi cập nhật org.
     *         content:
     *           application/json:
     *             example:
     *               {
     *                 code: 200,
     *                 data:
     *                   {
     *                     id: 1,
     *                     login_id: "111111",
     *                     type: 4,
     *                     status: 2,
     *                     mail_address: "user@example.com",
     *                     parent_id: null,
     *                     name_company_or_hro: "担当者1",
     *                     company: { id: 1, company_name: "…", jobType: {}, job: {} },
     *                     hr_organization: null,
     *                     support_organization: null
     *                   }
     *               }
     *       "401":
     *         description: Đăng nhập thất bại
     *         content:
     *           application/json:
     *             example: { code: 401, message: "Sai tài khoản hoặc mật khẩu" }
     */
    async getProfile(req, res, next) {
        try {
            const data = await authRepository.getProfile(req.user.id);
            if (!data) {
                return ResponseService.responseJsonError(res, HTTP_STATUS.NOT_FOUND, 'User not found', null);
            }
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (e) {
            return next(e);
        }
    }

    /**
     * @openapi
     * /auth/confirm-password:
     *   post:
     *     tags: [Auth]
     *     summary: Confirm password
     *     operationId: confirm_password
     *     description: Laravel `@OA` dùng query; Express dùng JSON body `current_password`, `current_password_confirm`.
     *     security:
     *       - auth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [current_password, current_password_confirm]
     *             properties:
     *               current_password: { type: string }
     *               current_password_confirm: { type: string }
     *     responses:
     *       "200":
     *         description: send request success
     *         content:
     *           application/json:
     *             example: { code: 200, data: "" }
     *       "401":
     *         description: password not correct
     *         content:
     *           application/json:
     *             example: { code: 401, data: "Password not correct." }
     *       "403":
     *         description: access denied permissions
     *         content:
     *           application/json:
     *             example: { code: 403, message: "Từ chối quyền truy cập" }
     */
    async confirmPassword(req, res, next) {
        try {
            const current = req.body?.current_password;
            const confirm = req.body?.current_password_confirm;
            if (String(current) !== String(confirm)) {
                return ResponseService.responseJson(res, HTTP_STATUS.UNAUTHORIZED, 'Password confirmation does not match');
            }
            const ok = await authRepository.checkPassword(req.user, current);
            if (ok) {
                return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, '');
            }
            return ResponseService.responseJson(res, HTTP_STATUS.UNAUTHORIZED, 'Password not correct.');
        } catch (e) {
            return next(e);
        }
    }

    /**
     * @openapi
     * /auth/change-password:
     *   put:
     *     tags: [Auth]
     *     summary: Change password
     *     operationId: change_password
     *     description: Laravel `@OA` dùng query; Express dùng JSON body.
     *     security:
     *       - auth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [new_password, new_password_confirm]
     *             properties:
     *               new_password: { type: string }
     *               new_password_confirm: { type: string }
     *     responses:
     *       "200":
     *         description: send request success
     *         content:
     *           application/json:
     *             example: { code: 200, data: "New password reset completed" }
     *       "403":
     *         description: access denied permissions
     *         content:
     *           application/json:
     *             example: { code: 403, message: "Từ chối quyền truy cập" }
     */
    async changePassword(req, res, next) {
        try {
            const np = req.body?.new_password;
            const npc = req.body?.new_password_confirm;
            if (String(np) !== String(npc)) {
                return ResponseService.responseJsonValidationError(res, [
                    { field: 'new_password_confirm', message: 'Password confirmation does not match' }
                ]);
            }
            await authRepository.changePassword(req.user, np);
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                'New password reset completed'
            );
        } catch (e) {
            return next(e);
        }
    }
}

module.exports = AuthController;
