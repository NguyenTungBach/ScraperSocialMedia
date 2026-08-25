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

const runScraperSchema = z
    .object({
        captionText: z.boolean().optional(),
        resultsLimit: z.number().int().min(1).max(100).optional(),
        startUrls: z.array(startUrlSchema).min(1).optional(),
    })
    .optional();

const listQueryObjectSchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
    status: z.string().optional(),
    q: z.string().optional(),
    key_search: z.string().optional(),
    sort_by: z
        .enum(['hot_score', 'trend_score', 'discussion', 'interaction', 'sentiment'])
        .optional(),
    new_only: z
        .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
        .optional()
        .transform((value) => {
            if (value === undefined) return false;
            if (typeof value === 'boolean') return value;
            return value === 'true' || value === '1';
        }),
});

const withSearchAlias = (data) => ({
    ...data,
    q: (data.q ?? data.key_search ?? '').trim() || undefined,
});

const listQuerySchema = listQueryObjectSchema.transform(withSearchAlias);

const socialPostsDashboardQuerySchema = listQueryObjectSchema
    .extend({
        chart_limit: z.coerce.number().int().min(1).max(20).optional(),
    })
    .transform(withSearchAlias);

const subjectCreateSchema = z.object({
    name: z.string().trim().min(1, 'name is required').max(255),
    normalized_name: z.string().trim().max(255).optional().nullable(),
    item_type: z.string().trim().max(255).optional(),
    status: z.string().trim().max(255).optional(),
    source: z.string().trim().max(255).optional(),
});

const subjectUpdateSchema = z
    .object({
        name: z.string().trim().min(1, 'name is required').max(255).optional(),
        normalized_name: z.string().trim().max(255).optional().nullable(),
        item_type: z.string().trim().max(255).optional(),
        status: z.string().trim().max(255).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field is required',
    });

const subjectDetailQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
    sort_by: z
        .enum(['posted_at', 'likes', 'comments', 'shares', 'interaction', 'hot_score'])
        .optional(),
});

const alertGmailSchema = z
    .object({
        subject_id: z.coerce.number().int().positive().optional(),
        to: z.string().email().optional(),
    })
    .optional();

const apifyRunsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
    status: z.string().optional(),
    desc: z
        .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
        .optional()
        .transform((value) => {
            if (value === undefined) return true;
            if (typeof value === 'boolean') return value;
            return value === 'true' || value === '1';
        }),
});

const runFromHistorySchema = z.object({
    runId: z.string().min(1, 'runId is required'),
});

const validateRunScraper = async (req, res, next) => {
    try {
        const validated = runScraperSchema.parse(req.body ?? {});
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

const validateSocialPostsDashboardQuery = async (req, res, next) => {
    try {
        req.validatedData = socialPostsDashboardQuerySchema.parse(req.query ?? {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

const validateSubjectDetailQuery = async (req, res, next) => {
    try {
        req.validatedData = subjectDetailQuerySchema.parse(req.query ?? {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

const validateSubjectCreate = async (req, res, next) => {
    try {
        req.validatedData = subjectCreateSchema.parse(req.body ?? {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

const validateSubjectUpdate = async (req, res, next) => {
    try {
        req.validatedData = subjectUpdateSchema.parse(req.body ?? {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

const validateApifyRunsQuery = async (req, res, next) => {
    try {
        req.validatedData = apifyRunsQuerySchema.parse(req.query ?? {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

const validateRunFromHistory = async (req, res, next) => {
    try {
        req.validatedData = runFromHistorySchema.parse(req.body ?? {});
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

const validateAlertGmail = async (req, res, next) => {
    try {
        const validated = alertGmailSchema.parse(req.body ?? {});
        req.validatedData = validated ?? {};
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return ResponseService.responseJsonValidationError(res, buildZodErrors(error));
        }
        return next(error);
    }
};

module.exports = {
    validateRunScraper,
    validateListQuery,
    validateSocialPostsDashboardQuery,
    validateSubjectDetailQuery,
    validateSubjectCreate,
    validateSubjectUpdate,
    validateApifyRunsQuery,
    validateRunFromHistory,
    validateAlertGmail,
};
