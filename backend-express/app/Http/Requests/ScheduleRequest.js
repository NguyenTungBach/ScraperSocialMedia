'use strict';

const { z } = require('zod');
const cron = require('node-cron');
const ResponseService = require('../../Helpers/ResponseService');
const Translation = require('../../Helpers/Translation');
const { buildZodErrors } = require('./zodErrors');
const { validateAllowedCommand } = require('../../Helpers/ScheduleCommandHelper');

const listSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    per_page: z.coerce.number().int().min(1).max(100).optional().default(50),
    q: z.string().optional().nullable(),
    enabled: z
        .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal(1), z.literal(0)])
        .optional()
        .nullable(),
});

const createSchema = z.object({
    name: z.string().trim().min(1).max(191),
    cron_expression: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .refine((v) => cron.validate(v), { message: 'Invalid cron_expression' }),
    command: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine((v) => validateAllowedCommand(v).ok, {
            message: 'command must be an allowed "npm run app:*" script',
        }),
    enabled: z.boolean().optional().default(true),
});

const updateSchema = z
    .object({
        name: z.string().trim().min(1).max(191).optional(),
        cron_expression: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .refine((v) => cron.validate(v), { message: 'Invalid cron_expression' })
            .optional(),
        command: z
            .string()
            .trim()
            .min(1)
            .max(255)
            .refine((v) => validateAllowedCommand(v).ok, {
                message: 'command must be an allowed "npm run app:*" script',
            })
            .optional(),
        enabled: z.boolean().optional(),
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

const validateIndexSchedule = async (req, res, next) => {
    try {
        req.validatedData = listSchema.parse({
            page: req.query.page,
            per_page: req.query.per_page,
            q: req.query.q ?? req.query.key_search,
            enabled: req.query.enabled ?? undefined,
        });
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return sendZodError(res, error);
        }
        return next(error);
    }
};

const validateCreateSchedule = async (req, res, next) => {
    try {
        const validated = createSchema.parse(req.body || {});
        const commandCheck = validateAllowedCommand(validated.command);
        validated.command = commandCheck.command;
        req.validatedData = validated;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return sendZodError(res, error);
        }
        return next(error);
    }
};

const validateUpdateSchedule = async (req, res, next) => {
    try {
        const validated = updateSchema.parse(req.body || {});
        if (validated.command != null) {
            const commandCheck = validateAllowedCommand(validated.command);
            validated.command = commandCheck.command;
        }
        req.validatedData = validated;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return sendZodError(res, error);
        }
        return next(error);
    }
};

module.exports = {
    validateIndexSchedule,
    validateCreateSchedule,
    validateUpdateSchedule,
};
