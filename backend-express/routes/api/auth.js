const express = require('express');
const router = express.Router();
const AuthController = require('../../app/Http/Controllers/Api/AuthController');
const authenticate = require('../../app/Http/Middleware/Authenticate');
const {
    validateLogin,
    validateForgetPassword,
    validateResetPassword,
    validateConfirmPassword,
    validateChangePassword
} = require('../../app/Http/Requests/AuthRequest');

const authController = new AuthController();

router.post('/login', validateLogin, authController.login.bind(authController));
router.post('/forget-password', validateForgetPassword, authController.forgetPassword.bind(authController));
router.put('/password-reset', validateResetPassword, authController.resetPassword.bind(authController));

const authed = express.Router();
authed.use(authenticate());
authed.post('/confirm-password', validateConfirmPassword, authController.confirmPassword.bind(authController));
authed.put('/change-password', validateChangePassword, authController.changePassword.bind(authController));

router.use(authed);

module.exports = router;
