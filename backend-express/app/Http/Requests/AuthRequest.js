'use strict';

const { z } = require('zod');
const ResponseService = require('../../Helpers/ResponseService');
const Translation = require('../../Helpers/Translation');
const { buildZodErrors } = require('./zodErrors');

const msg = (key) => Translation.trans(`api.${key}`);

const loginBodySchema = z.object({
    user_code: z.string().min(1, msg('auth.user_code.required') || 'user_code is required'),
    password: z.string().min(1, msg('auth.password.required'))
});

const forgetPasswordBodySchema = z.object({
    mail_address: z.string().trim().min(1, msg('auth.forget_password.mail_required'))
});

const resetPasswordBodySchema = z
    .object({
        token: z.string().trim().min(1, 'Token is required'),
        mail_address: z.string().trim().email(msg('auth.forget_password.mail_required')),
        new_password: z.string().min(1, msg('auth.new_password.required')),
        new_password_confirm: z.string().min(1, msg('auth.new_password_confirm.required'))
    })
    .refine((data) => data.new_password === data.new_password_confirm, {
        message: 'Password confirmation does not match',
        path: ['new_password_confirm']
    });

const confirmPasswordBodySchema = z.object({
    current_password: z.string().min(1, msg('auth.current_password.required')),
    current_password_confirm: z.string().min(1, msg('auth.current_password_confirm.required'))
});

const changePasswordBodySchema = z.object({
    new_password: z.string().min(1, msg('auth.new_password.required')),
    new_password_confirm: z.string().min(1, msg('auth.new_password_confirm.required'))
});

const validateLogin = async (req, res, next) => {
    try {
        loginBodySchema.parse(req.body || {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(
                res,
                buildZodErrors(error),
                Translation.trans('api.request.validation.validation_error')
            );
        }
        return next(error);
    }
};

const validateForgetPassword = async (req, res, next) => {
    try {
        forgetPasswordBodySchema.parse(req.body || {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(
                res,
                buildZodErrors(error),
                Translation.trans('api.request.validation.validation_error')
            );
        }
        return next(error);
    }
};

const validateResetPassword = async (req, res, next) => {
    try {
        resetPasswordBodySchema.parse(req.body || {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(
                res,
                buildZodErrors(error),
                Translation.trans('api.request.validation.validation_error')
            );
        }
        return next(error);
    }
};

const validateConfirmPassword = async (req, res, next) => {
    try {
        confirmPasswordBodySchema.parse(req.body || {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(
                res,
                buildZodErrors(error),
                Translation.trans('api.request.validation.validation_error')
            );
        }
        return next(error);
    }
};

const validateChangePassword = async (req, res, next) => {
    try {
        changePasswordBodySchema.parse(req.body || {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(
                res,
                buildZodErrors(error),
                Translation.trans('api.request.validation.validation_error')
            );
        }
        return next(error);
    }
};

module.exports = {
    validateLogin,
    validateForgetPassword,
    validateResetPassword,
    validateConfirmPassword,
    validateChangePassword
};
