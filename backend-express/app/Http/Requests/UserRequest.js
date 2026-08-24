'use strict';

const { z } = require('zod');
const ResponseService = require('../../Helpers/ResponseService');
const Translation = require('../../Helpers/Translation');
const { buildZodErrors } = require('./zodErrors');

const indexUserSchema = z.object({
    field: z.string().optional().nullable(),
    sort_by: z.enum(['asc', 'desc']).optional().nullable(),
    key_search: z.string().optional().nullable(),
    page: z.string().regex(/^\d+$/).optional().nullable(),
    per_page: z.string().regex(/^-?\d+$/).optional().nullable()
});

/** GET /api/users */
const validateIndexUser = async (req, res, next) => {
    try {
        const validatedData = indexUserSchema.parse({
            field: req.query.field,
            sort_by: req.query.sort_by,
            key_search: req.query.key_search,
            page: req.query.page,
            per_page: req.query.per_page
        });
        req.validatedData = validatedData;
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
    validateIndexUser
};
