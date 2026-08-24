'use strict';

const { z } = require('zod');

/**
 * Zod issues → `{ field, message }[]` (dotted path) — tương thích `ResponseService` dạng mảng.
 * @param {import('zod').ZodIssue[]} issues
 * @returns {{ field: string, message: string }[]}
 */
function issuesToValidationArray(issues) {
    return issues.map((issue) => ({
        field:
            issue.path && issue.path.length
                ? issue.path.map((p) => (typeof p === 'number' ? String(p) : String(p))).join('.')
                : 'root',
        message: issue.message
    }));
}

/**
 * Mẫu Driver/Course: map lỗi theo **segment đầu** của `path` (giống `err.path[0]`).
 * @param {import('zod').ZodError} error
 * @returns {Record<string, string>}
 */
function buildZodErrors(error) {
    if (!(error instanceof z.ZodError)) return {};
    const errors = {};
    error.issues.forEach((err) => {
        const field = err.path?.length ? err.path[0] : 'field';
        errors[field] = err.message;
    });
    return errors;
}

/**
 * Nested/array: `hr_other_documents.0.type`, …
 * @param {import('zod').ZodError} error
 * @returns {Record<string, string>}
 */
function buildZodErrorsByFullPath(error) {
    if (!(error instanceof z.ZodError)) return {};
    const errors = {};
    error.issues.forEach((err) => {
        const field =
            err.path?.length > 0
                ? err.path.map((p) => (typeof p === 'number' ? String(p) : String(p))).join('.')
                : 'field';
        errors[field] = err.message;
    });
    return errors;
}

/**
 * `[{ field, message }]` → object một message / field (ghi đè nếu trùng field).
 * @param {{ field: string, message: string }[]} rows
 * @returns {Record<string, string>}
 */
function arrayFieldMessagesToObject(rows) {
    const o = {};
    if (!Array.isArray(rows)) return o;
    rows.forEach(({ field, message }) => {
        if (field != null && field !== '') o[field] = message;
    });
    return o;
}

/**
 * @param {unknown} error
 * @returns {error is z.ZodError}
 */
function isZodError(error) {
    return error instanceof z.ZodError;
}

module.exports = {
    issuesToValidationArray,
    buildZodErrors,
    buildZodErrorsByFullPath,
    arrayFieldMessagesToObject,
    isZodError
};
