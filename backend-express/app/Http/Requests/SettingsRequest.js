'use strict';

const { z } = require('zod');
const ResponseService = require('../../Helpers/ResponseService');
const Translation = require('../../Helpers/Translation');
const { buildZodErrors } = require('./zodErrors');
const {
    KEY_SCRAP_NAMES,
    GENERAL_SETTING_KEYS,
} = require('../../Constants/AppSettingsKeys');

const stringValue = z.union([z.string(), z.number(), z.null()]).transform((v) =>
    v == null ? '' : String(v)
);

const updateSettingsSchema = z
    .object({
        keys: z.record(z.string(), stringValue).optional(),
        settings: z.record(z.string(), stringValue).optional(),
    })
    .refine((data) => data.keys != null || data.settings != null, {
        message: 'keys or settings is required',
    })
    .superRefine((data, ctx) => {
        if (data.keys) {
            for (const name of Object.keys(data.keys)) {
                if (!KEY_SCRAP_NAMES.includes(name)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Unknown key: ${name}`,
                        path: ['keys', name],
                    });
                }
            }
        }
        if (data.settings) {
            for (const name of Object.keys(data.settings)) {
                if (!GENERAL_SETTING_KEYS.includes(name)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Unknown setting: ${name}`,
                        path: ['settings', name],
                    });
                }
            }
        }
    });

function sendZodError(res, error) {
    return ResponseService.responseJsonValidationError(
        res,
        buildZodErrors(error),
        Translation.trans('api.request.validation.validation_error')
    );
}

const validateUpdateSettings = async (req, res, next) => {
    try {
        req.validatedData = updateSettingsSchema.parse(req.body || {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return sendZodError(res, error);
        }
        return next(error);
    }
};

module.exports = {
    validateUpdateSettings,
};
