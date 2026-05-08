const express = require('express');
const { normalizeRpgOutput } = require('./lib/rpgOutputNormalizer');

function extractPrompt(body) {
    if (!body) return '';
    if (typeof body.prompt === 'string') return body.prompt;

    const contents = Array.isArray(body.contents) ? body.contents : [];
    return contents
        .flatMap((content) => Array.isArray(content && content.parts) ? content.parts : [])
        .map((part) => typeof part.text === 'string' ? part.text : '')
        .filter(Boolean)
        .join('\n');
}

function getActiveBrain(server, requestedGolemId) {
    if (requestedGolemId && server.contexts && server.contexts.has(requestedGolemId)) {
        return server.contexts.get(requestedGolemId).brain;
    }

    if (server.contexts && server.contexts.size > 0) {
        const first = server.contexts.values().next().value;
        if (first && first.brain) return first.brain;
    }

    if (typeof global.getOrCreateGolem === 'function') {
        const instance = global.getOrCreateGolem();
        return instance && instance.brain ? instance.brain : null;
    }

    return null;
}

function getActiveGolemInstance(server, requestedGolemId) {
    try {
        const runtime = require('../../index.js');
        if (runtime && typeof runtime.getOrCreateGolem === 'function') {
            return runtime.getOrCreateGolem(requestedGolemId || 'golem_A');
        }
    } catch (_) { }

    const brain = getActiveBrain(server, requestedGolemId);
    return brain ? { brain } : null;
}

function enqueueRpgPrompt(convoManager, prompt, options, golemId) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutMs = Number(options.responseTimeoutMs || 900000) + 30000;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('RPG request timed out while waiting for Golem queue response.'));
        }, timeoutMs);

        const settle = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn(value);
        };

        const ctx = {
            platform: 'web-rpg',
            chatId: `web-rpg-${golemId || 'golem_A'}`,
            isAdmin: true,
            text: prompt,
            messageTime: Date.now(),
            senderName: 'RPG',
            replyToName: '',
            instance: { username: golemId || 'golem_A' },
            sendTyping: async () => { },
            getAttachment: async () => null,
            reply: async (text) => {
                settle(resolve, typeof text === 'string' ? text : JSON.stringify(text || ''));
            },
        };

        Promise.resolve(convoManager.enqueue(ctx, prompt, {
            ...options,
            isPriority: true,
            bypassDebounce: true,
            attachment: null,
        })).catch((error) => settle(reject, error));
    });
}

async function generateWithBrain(brain, prompt, instance = null, golemId = 'golem_A') {
    const configuredTimeoutMs = Number(process.env.GOLEM_RPG_RESPONSE_TIMEOUT_MS);
    const responseTimeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
        ? configuredTimeoutMs
        : 900000;
    const generationOptions = {
        responseTimeoutMs,
        allowPartialOnTimeout: true,
        _rpgBypass: true,
        disableToolRouting: true,
        allowActions: false,
    };

    if (instance && instance.convoManager && typeof instance.convoManager.enqueue === 'function') {
        return enqueueRpgPrompt(instance.convoManager, prompt, generationOptions, golemId);
    }

    if (typeof brain.sendMessage === 'function') {
        const result = await brain.sendMessage(prompt, false, generationOptions);
        return typeof result === 'string' ? result : (result && result.text) || '';
    }

    if (typeof brain._wikiChat === 'function') {
        return brain._wikiChat(prompt, generationOptions);
    }

    throw new Error('Active Golem brain does not expose a text generation method.');
}

function buildRpgPrompt(userPrompt) {
    return `You are currently serving the Project Golem Text RPG web app, not a normal chat session.

RPG OUTPUT BOUNDARY:
- Follow the normal Project Golem response protocol required by the system.
- Put the RPG result only inside [GOLEM_REPLY].
- Do NOT call tools or describe actions being executed.
- Do NOT write memory notes, status narration, or assistant prefaces.
- Do NOT use [GOLEM_ACTION].
- If the RPG prompt requests JSON, the content inside [GOLEM_REPLY] must be valid JSON only.

RPG PROMPT:
${userPrompt}`;
}

module.exports = function registerRpgRoutes(server) {
    const router = express.Router();

    router.post('/api/rpg/generateContent', async (req, res) => {
        const startedAt = Date.now();
        try {
            const prompt = extractPrompt(req.body);
            if (!prompt.trim()) {
                return res.status(400).json({ error: 'Missing prompt text.' });
            }

            const golemId = String(req.query.golemId || req.body.golemId || '').trim();
            const instance = getActiveGolemInstance(server, golemId);
            const brain = instance && instance.brain ? instance.brain : getActiveBrain(server, golemId);
            if (!brain) {
                return res.status(503).json({ error: 'No active Golem brain is available.' });
            }

            const text = await generateWithBrain(brain, buildRpgPrompt(prompt), instance, golemId || 'golem_A');
            const output = normalizeRpgOutput(text);
            if (!output) {
                return res.status(502).json({ error: 'Golem returned an empty response.' });
            }

            server.broadcastLog({
                time: new Date().toLocaleTimeString('zh-TW', { hour12: false }),
                msg: `[RPG] Golem generated ${output.length} chars in ${Date.now() - startedAt}ms`,
                type: 'system',
                raw: output.slice(0, 500),
                golemId: golemId || 'golem_A'
            });

            return res.json({
                candidates: [{
                    content: {
                        parts: [{ text: output }]
                    }
                }],
                model: req.query.model || 'golem',
                source: 'project-golem'
            });
        } catch (e) {
            console.error('[RPG] generateContent failed:', e);
            return res.status(500).json({ error: e.message });
        }
    });

    return router;
};

module.exports._private = {
    buildRpgPrompt,
    enqueueRpgPrompt,
    generateWithBrain,
    getActiveGolemInstance,
    normalizeRpgOutput,
};
