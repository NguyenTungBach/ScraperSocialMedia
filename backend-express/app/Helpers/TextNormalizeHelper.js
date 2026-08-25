'use strict';

/**
 * Chuẩn hóa tên để dedup / match LIKE (bỏ dấu, lowercase).
 */
function normalizeName(value) {
    if (!value) return '';
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Haystack chứa needle theo kiểu %needle% (sau khi normalize).
 */
function includesNormalized(haystack, needle) {
    const h = normalizeName(haystack);
    const n = normalizeName(needle);
    if (!h || !n) return false;
    return h.includes(n);
}

/**
 * Tách "Họ tên (Biệt danh)" → { full, realName, alias }.
 * VD: "Trần Thị Ngọc Trinh (Ngọc Trinh)" → realName + alias
 */
function parsePersonName(raw) {
    const full = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!full) {
        return { full: '', realName: '', alias: null };
    }

    const match = full.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (match) {
        return {
            full,
            realName: match[1].trim(),
            alias: match[2].trim() || null,
        };
    }

    return { full, realName: full, alias: null };
}

/**
 * Tập token dùng để so trùng: full, tên thật, biệt danh (đã normalize).
 */
function personNameTokens(rawOrParsed) {
    const parsed =
        typeof rawOrParsed === 'string' || rawOrParsed == null
            ? parsePersonName(rawOrParsed)
            : rawOrParsed;

    return new Set(
        [parsed.full, parsed.realName, parsed.alias]
            .filter(Boolean)
            .map(normalizeName)
            .filter(Boolean)
    );
}

/**
 * Hai tên trùng nếu giao nhau ở tên thật hoặc biệt danh (sau normalize).
 */
function personNamesOverlap(a, b) {
    const tokensA = personNameTokens(a);
    const tokensB = personNameTokens(b);
    for (const token of tokensA) {
        if (tokensB.has(token)) return true;
    }
    return false;
}

module.exports = {
    normalizeName,
    includesNormalized,
    parsePersonName,
    personNameTokens,
    personNamesOverlap,
};
