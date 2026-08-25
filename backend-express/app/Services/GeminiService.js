'use strict';

const createError = require('http-errors');
const geminiConfig = require('../../config/gemini');
const { parsePersonName } = require('../Helpers/TextNormalizeHelper');

class GeminiService {
    ensureEnabled() {
        if (!geminiConfig.enabled) {
            throw createError(503, 'Gemini is disabled. Set GEMINI_ENABLED=true in .env');
        }
        if (!geminiConfig.apiKey) {
            throw createError(500, 'GEMINI_API_KEY is not configured');
        }
    }

    buildUrl(modelName = geminiConfig.model) {
        const model = encodeURIComponent(modelName);
        return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiConfig.apiKey}`;
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    isRetryableGeminiError(status, message = '') {
        const msg = String(message).toLowerCase();
        if (status === 429 || status === 503) return true;
        return (
            msg.includes('high demand') ||
            msg.includes('try again later') ||
            msg.includes('resource_exhausted') ||
            msg.includes('unavailable') ||
            msg.includes('overloaded') ||
            msg.includes('quota')
        );
    }

    modelCandidates() {
        const models = [geminiConfig.model, ...(geminiConfig.fallbackModels || [])];
        return [...new Set(models.filter(Boolean))];
    }

    buildGenerateBody(prompt) {
        return {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4,
                topP: 0.9,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        data: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    name: { type: 'STRING' },
                                    nick_name: { type: 'STRING' },
                                },
                                required: ['name', 'nick_name'],
                            },
                        },
                    },
                    required: ['data'],
                },
            },
        };
    }

    async callGenerateContent(modelName, prompt) {
        const response = await fetch(this.buildUrl(modelName), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.buildGenerateBody(prompt)),
        });
        const payload = await response.json().catch(() => ({}));
        return { response, payload, modelName };
    }

    extractText(payload) {
        const parts = payload?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return '';
        return parts.map((part) => part.text || '').join('\n').trim();
    }

    snippet(text, max = 240) {
        const s = String(text || '').replace(/\s+/g, ' ').trim();
        if (s.length <= max) return s;
        return `${s.slice(0, max)}…`;
    }

    /**
     * Đóng nốt [ ] { } còn thiếu (thường do MAX_TOKENS cắt giữa JSON).
     */
    closeTruncatedJson(fragment) {
        let inString = false;
        let escape = false;
        let openCurly = 0;
        let openSquare = 0;

        for (let i = 0; i < fragment.length; i += 1) {
            const ch = fragment[i];
            if (inString) {
                if (escape) {
                    escape = false;
                } else if (ch === '\\') {
                    escape = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }
            if (ch === '"') {
                inString = true;
            } else if (ch === '{') {
                openCurly += 1;
            } else if (ch === '}') {
                openCurly = Math.max(0, openCurly - 1);
            } else if (ch === '[') {
                openSquare += 1;
            } else if (ch === ']') {
                openSquare = Math.max(0, openSquare - 1);
            }
        }

        // Nếu đang dở chuỗi / object giữa chừng: cắt về object hoàn chỉnh gần nhất
        let repaired = fragment;
        if (inString || openCurly > 0 || openSquare > 0) {
            const lastComplete = repaired.lastIndexOf('}');
            if (lastComplete === -1) return null;
            repaired = repaired.slice(0, lastComplete + 1);

            openCurly = 0;
            openSquare = 0;
            inString = false;
            escape = false;
            for (let i = 0; i < repaired.length; i += 1) {
                const ch = repaired[i];
                if (inString) {
                    if (escape) {
                        escape = false;
                    } else if (ch === '\\') {
                        escape = true;
                    } else if (ch === '"') {
                        inString = false;
                    }
                    continue;
                }
                if (ch === '"') inString = true;
                else if (ch === '{') openCurly += 1;
                else if (ch === '}') openCurly = Math.max(0, openCurly - 1);
                else if (ch === '[') openSquare += 1;
                else if (ch === ']') openSquare = Math.max(0, openSquare - 1);
            }
        }

        // Bỏ trailing comma trước khi đóng
        repaired = repaired.replace(/,\s*$/, '');
        repaired += ']'.repeat(openSquare) + '}'.repeat(openCurly);
        return repaired;
    }

    tryParseObject(text) {
        try {
            return JSON.parse(text);
        } catch {
            const repaired = this.closeTruncatedJson(text);
            if (!repaired) return null;
            try {
                return JSON.parse(repaired);
            } catch {
                return null;
            }
        }
    }

    /**
     * Fallback: lấy từng object {name, nick_name} hoàn chỉnh bằng regex.
     */
    extractItemsByRegex(text) {
        const items = [];
        const re =
            /\{\s*"name"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"nick_name"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/g;
        let match;
        while ((match = re.exec(text)) !== null) {
            try {
                items.push({
                    name: JSON.parse(`"${match[1]}"`),
                    nick_name: JSON.parse(`"${match[2]}"`),
                });
            } catch {
                // skip malformed escape
            }
        }
        return items;
    }

    normalizeDataItems(list) {
        return (list || [])
            .map((item) => {
                if (typeof item === 'string') {
                    const parsed = parsePersonName(item);
                    if (!parsed.realName) return null;
                    return { name: parsed.realName, nick_name: parsed.alias || '' };
                }
                if (!item || typeof item !== 'object') return null;

                const name = String(item.name || item.title || '').trim();
                const nick_name = String(
                    item.nick_name ?? item.nickname ?? item.nickName ?? item.alias ?? ''
                ).trim();
                if (!name) return null;
                return { name, nick_name };
            })
            .filter(Boolean);
    }

    parseDataJson(rawText, { finishReason } = {}) {
        let text = String(rawText || '').trim();
        if (!text) {
            throw createError(
                502,
                `Empty Gemini response (finishReason=${finishReason || 'unknown'})`
            );
        }

        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced) {
            text = fenced[1].trim();
        }

        const start = text.indexOf('{');
        if (start === -1) {
            throw createError(502, `Gemini response is not valid JSON object: ${this.snippet(text)}`);
        }

        const fragment = text.slice(start);
        let parsed = this.tryParseObject(fragment);

        if (!parsed || !Array.isArray(parsed.data)) {
            const regexItems = this.extractItemsByRegex(fragment);
            if (regexItems.length > 0) {
                return this.normalizeDataItems(regexItems);
            }

            const hint =
                finishReason === 'MAX_TOKENS'
                    ? ' (response truncated by MAX_TOKENS)'
                    : '';
            throw createError(
                502,
                `Failed to parse Gemini JSON response${hint}: ${this.snippet(fragment)}`
            );
        }

        return this.normalizeDataItems(parsed.data);
    }

    /**
     * Gọi Gemini lấy danh sách đối tượng → { data: [{ name, nick_name }] }
     * Retry khi high demand / 429 / 503, rồi fallback model khác.
     */
    async discoverSubjects(promptOverride = null) {
        this.ensureEnabled();

        const prompt = promptOverride || geminiConfig.discoverSubjectsPrompt;
        const models = this.modelCandidates();
        const maxRetries = Math.max(0, geminiConfig.maxRetries || 0);
        const baseDelay = Math.max(200, geminiConfig.retryDelayMs || 1200);

        let lastErrorMessage = 'Gemini API error';

        for (let mi = 0; mi < models.length; mi += 1) {
            const modelName = models[mi];

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                const { response, payload } = await this.callGenerateContent(modelName, prompt);

                if (!response.ok) {
                    lastErrorMessage =
                        payload?.error?.message || `Gemini API error (${response.status})`;
                    const retryable = this.isRetryableGeminiError(response.status, lastErrorMessage);
                    const hasRetryLeft = attempt < maxRetries;
                    const hasNextModel = mi < models.length - 1;

                    if (retryable && hasRetryLeft) {
                        await this.sleep(baseDelay * (attempt + 1));
                        continue;
                    }
                    if (retryable && hasNextModel) {
                        break; // thử model fallback
                    }
                    throw createError(502, lastErrorMessage);
                }

                const blockReason = payload?.promptFeedback?.blockReason;
                if (blockReason) {
                    throw createError(502, `Gemini blocked the prompt (${blockReason})`);
                }

                const finishReason = payload?.candidates?.[0]?.finishReason;
                const rawText = this.extractText(payload);
                const data = this.parseDataJson(rawText, { finishReason });

                return { data, raw: payload, model: modelName };
            }
        }

        throw createError(502, lastErrorMessage);
    }
}

module.exports = GeminiService;
