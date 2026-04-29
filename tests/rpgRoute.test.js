describe('RPG generateContent route helpers', () => {
    test('normalizeRpgOutput extracts JSON from Golem protocol replies', () => {
        const { normalizeRpgOutput } = require('../web-dashboard/routes/lib/rpgOutputNormalizer');

        const raw = `[[BEGIN:v5mz]]
[GOLEM_MEMORY]
{
  "task": "Generate 3 Wuxia text RPG concepts"
}
[GOLEM_REPLY]
[
  {
    "id": "shadow-of-the-jade-emperor",
    "genre": "武俠",
    "icon": "ph-duotone ph-crown",
    "title": { "zh-TW": "玉皇影衛", "en": "Shadow of the Jade Emperor", "ja": "玉皇の影" },
    "description": { "zh-TW": "你奉命潛入禁城。", "en": "You infiltrate the forbidden city.", "ja": "あなたは禁城に潜入する。" }
  }
]
[[END:v5mz]]`;

        const output = normalizeRpgOutput(raw);

        expect(output.trim().startsWith('[')).toBe(true);
        expect(output).not.toContain('[GOLEM_MEMORY]');
        expect(output).not.toContain('[GOLEM_REPLY]');
        expect(JSON.parse(output)[0].id).toBe('shadow-of-the-jade-emperor');
    });
});
