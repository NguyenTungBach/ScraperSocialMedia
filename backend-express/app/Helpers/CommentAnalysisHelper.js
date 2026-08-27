'use strict';

const LABEL_MAP = {
    negative: 'Tiêu cực',
    normal: 'Bình thường',
    debate: 'Tranh luận',
    unknown: 'Không xác định',
    attack: 'Công kích',
    provoke: 'Khiêu khích',
    argument: 'Tranh cãi',
    opinion: 'Nhận định',
    other: 'Khác',
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    positive: 'Tích cực',
    neutral: 'Trung tính',
    lone: 'Đơn lẻ',
    thread: 'Chuỗi hội thoại',
};

function classifyLabel(value) {
    if (!value) return '—';
    return LABEL_MAP[String(value)] || String(value);
}

function hasStoredLoneAnalysis(comment) {
    return (
        comment.analysis_status === 'done' ||
        comment.classified_as ||
        comment.reason ||
        (comment.sentiment && comment.sentiment !== 'unknown') ||
        (comment.category && comment.category !== 'unknown')
    );
}

function hasStoredThreadAnalysis(thread) {
    return (
        thread.analysis_status === 'done' ||
        thread.classified_as ||
        thread.reason ||
        (thread.sentiment && thread.sentiment !== 'unknown') ||
        (thread.category && thread.category !== 'unknown')
    );
}

function buildAnalysisRows(lone = [], threads = []) {
    const rows = [];

    for (const comment of lone) {
        if (!hasStoredLoneAnalysis(comment)) continue;
        rows.push({
            key: `lone-${comment.id}`,
            groupType: 'lone',
            classifiedAs: comment.classified_as,
            author: comment.author || 'Ẩn danh',
            text: comment.text,
            replyCount: 0,
            replies: [],
            sentiment: comment.sentiment,
            category: comment.category,
            severity: comment.severity,
            reason: comment.reason,
            hasNegativity: false,
        });
    }

    for (const thread of threads) {
        if (!hasStoredThreadAnalysis(thread)) continue;
        const comments = thread.comments || [];
        const [root, ...replies] = comments;
        rows.push({
            key: `thread-${thread.id}`,
            groupType: 'thread',
            classifiedAs: thread.classified_as,
            author: root?.author || 'Ẩn danh',
            text: root?.text || '—',
            replyCount: replies.length,
            replies,
            sentiment: thread.sentiment,
            category: thread.category,
            severity: thread.severity,
            reason: thread.reason,
            hasNegativity: Boolean(thread.has_negativity),
        });
    }

    const order = (value) => {
        if (value === 'negative') return 0;
        if (value === 'debate') return 1;
        if (value === 'normal') return 2;
        return 3;
    };

    return rows.sort((a, b) => order(a.classifiedAs) - order(b.classifiedAs));
}

function countAnalysisByType(rows = []) {
    return {
        negative: rows.filter((r) => r.classifiedAs === 'negative').length,
        debate: rows.filter((r) => r.classifiedAs === 'debate').length,
        normal: rows.filter((r) => r.classifiedAs === 'normal').length,
        total: rows.length,
    };
}

function hasAnalysisData(lone = [], threads = []) {
    return lone.some(hasStoredLoneAnalysis) || threads.some(hasStoredThreadAnalysis);
}

module.exports = {
    classifyLabel,
    buildAnalysisRows,
    countAnalysisByType,
    hasAnalysisData,
};
