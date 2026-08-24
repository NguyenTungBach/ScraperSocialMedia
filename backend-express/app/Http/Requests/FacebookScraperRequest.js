'use strict';

const { z } = require('zod');
const ResponseService = require('../../Helpers/ResponseService');
const { buildZodErrors } = require('./zodErrors');

const startUrlSchema = z.union([
    z.string().url('startUrls must contain valid URLs'),
    z.object({
        url: z.string().url('startUrls must contain valid URLs'),
    }),
]);

const runFacebookScraperSchema = z
    .object({
        subject_id: z.coerce.number().int().positive().optional(),
        captionText: z.boolean().optional(),
        resultsLimit: z.number().int().min(1).max(100).optional(),
        startUrls: z.array(startUrlSchema).min(1).optional(),
    })
    .optional();

const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
    subject_id: z.coerce.number().int().positive().optional(),
    today: z
        .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
        .optional()
        .transform((value) => value === 'true' || value === '1'),
});

const validateRunFacebookScraper = async (req, res, next) => {
    try {
        const validated = runFacebookScraperSchema.parse(req.body ?? {});
        req.validatedData = validated ?? {};
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

const validateListQuery = async (req, res, next) => {
    try {
        req.validatedData = listQuerySchema.parse(req.query ?? {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

module.exports = {
    validateRunFacebookScraper,
    validateListQuery,
};
