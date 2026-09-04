'use strict';

const { z } = require('zod');
const ResponseService = require('../../Helpers/ResponseService');
const Translation = require('../../Helpers/Translation');
const UserType = require('../../Constants/UserType');
const UserStatus = require('../../Constants/UserStatus');
const { buildZodErrors } = require('./zodErrors');

const roleEnum = z.enum([UserType.ADMIN, UserType.MEMBER]);
const statusEnum = z.union([
    z.literal(UserStatus.ON),
    z.literal(UserStatus.OFF),
    z.literal(String(UserStatus.ON)),
    z.literal(String(UserStatus.OFF)),
]);

const passwordSchema = z
    .string()
    .regex(/^\S{8,16}$/, 'Password must be 8–16 characters without spaces');

const userCodeSchema = z
    .string()
    .trim()
    .regex(/^\d{1,15}$/, 'user_code must be 1–15 digits');

const listUserSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
    q: z.string().optional().nullable(),
    role: roleEnum.optional().nullable(),
    status: statusEnum.optional().nullable(),
});

const createUserSchema = z.object({
    user_code: userCodeSchema,
    user_name: z.string().trim().min(1).max(20),
    password: passwordSchema,
    role: roleEnum.default(UserType.MEMBER),
    status: statusEnum.optional().default(UserStatus.ON),
});

const updateUserSchema = z
    .object({
        user_code: userCodeSchema.optional(),
        user_name: z.string().trim().min(1).max(20).optional(),
        password: passwordSchema.optional().or(z.literal('')),
        role: roleEnum.optional(),
        status: statusEnum.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field is required',
    });

function sendZodError(res, error) {
    return ResponseService.responseJsonValidationError(
        res,
        buildZodErrors(error),
        Translation.trans('api.request.validation.validation_error')
    );
}

const validateIndexUser = async (req, res, next) => {
    try {
        const validatedData = listUserSchema.parse({
            page: req.query.page,
            per_page: req.query.per_page,
            q: req.query.q ?? req.query.key_search,
            role: req.query.role || undefined,
            status: req.query.status ?? undefined,
        });
        if (validatedData.status != null) {
            validatedData.status = Number(validatedData.status);
        }
        req.validatedData = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return sendZodError(res, error);
        }
        return next(error);
    }
};

const validateCreateUser = async (req, res, next) => {
    try {
        const validatedData = createUserSchema.parse(req.body || {});
        validatedData.status = Number(validatedData.status);
        req.validatedData = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return sendZodError(res, error);
        }
        return next(error);
    }
};

const validateUpdateUser = async (req, res, next) => {
    try {
        const validatedData = updateUserSchema.parse(req.body || {});
        if (validatedData.status != null) {
            validatedData.status = Number(validatedData.status);
        }
        if (validatedData.password === '') {
            delete validatedData.password;
        }
        req.validatedData = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return sendZodError(res, error);
        }
        return next(error);
    }
};

module.exports = {
    validateIndexUser,
    validateCreateUser,
    validateUpdateUser,
};
