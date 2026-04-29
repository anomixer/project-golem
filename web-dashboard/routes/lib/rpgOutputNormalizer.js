const ResponseParser = require('../../../src/utils/ResponseParser');

function stripEnvelope(text) {
    return String(text || '')
        .replace(/\[\[BEGIN:[^\]]+\]\]/gi, '')
        .replace(/\[\[END:[^\]]+\]\]/gi, '')
        .trim();
}

function normalizeRpgOutput(rawText) {
    const cleaned = stripEnvelope(rawText);
    if (!/\[GOLEM_(?:MEMORY|ACTION|REPLY)\]/i.test(cleaned)) {
        return cleaned;
    }

    const parsed = ResponseParser.parse(cleaned);
    const reply = stripEnvelope(parsed.reply || '');
    return reply || cleaned
        .replace(/\[GOLEM_MEMORY\][\s\S]*?(?=\[GOLEM_ACTION\]|\[GOLEM_REPLY\]|$)/gi, '')
        .replace(/\[GOLEM_ACTION\][\s\S]*?(?=\[GOLEM_REPLY\]|$)/gi, '')
        .replace(/\[GOLEM_REPLY\]/gi, '')
        .trim();
}

module.exports = {
    normalizeRpgOutput,
    stripEnvelope,
};
