// ============================================================
// ⚡ ResponseParser (JSON 解析器 - 寬鬆版 + 集中化 + 終極矯正)
// ============================================================
class ResponseParser {
    static parse(raw) {
        const parsed = { memory: null, actions: [], reply: "" };
        const SECTION_REGEX = /(?:\s*\[\s*)?GOLEM_(MEMORY|ACTION|REPLY)(?:\s*\]\s*|:)?([\s\S]*?)(?=(?:\s*\[\s*)?GOLEM_(?:MEMORY|ACTION|REPLY)|$)/ig;
        let match;
        let hasStructuredData = false;
        
        while ((match = SECTION_REGEX.exec(raw)) !== null) {
            hasStructuredData = true;
            const type = match[1].toUpperCase();
            const content = (match[2] || "").trim();
            
            if (type === 'MEMORY') {
                if (content && content !== 'null' && content !== '(無)') parsed.memory = content;
            } else if (type === 'ACTION') {
                const jsonCandidate = content.replace(/```[a-zA-Z]*\s*/gi, '').replace(/```/g, '').trim();
                if (jsonCandidate && jsonCandidate !== 'null') {
                    try {
                        const jsonObj = JSON.parse(jsonCandidate);
                        let steps = Array.isArray(jsonObj) ? jsonObj : (jsonObj.steps || [jsonObj]);
                        
                        // ✨ [核心修復：Schema 幻覺矯正器]
                        steps = steps.map(act => {
                            if (!act) return act;
                            
                            // 矯正 1: action 名稱 (run_command -> command)
                            if (act.action === 'run_command' || act.action === 'execute') {
                                act.action = 'command';
                            }
                            
                            // 矯正 2: parameter 欄位被藏在 params 物件裡
                            if (act.action === 'command' && !act.parameter && !act.cmd && !act.command) {
                                if (act.params && act.params.command) {
                                    act.parameter = act.params.command;
                                    console.log(`🔧 [Parser] 矯正幻覺欄位: params.command -> parameter`);
                                }
                            }
                            
                            return act;
                        });
                        
                        parsed.actions.push(...steps);
                    } catch (e) {
                        const fallbackMatch = jsonCandidate.match(/\[\s*\{[\s\S]*\}\s*\]/) || jsonCandidate.match(/\{[\s\S]*\}/);
                        if (fallbackMatch) {
                            try {
                                const fixed = JSON.parse(fallbackMatch[0]);
                                let steps = Array.isArray(fixed) ? fixed : [fixed];
                                
                                // ✨ [核心修復：Schema 幻覺矯正器 (Fallback 路線)]
                                steps = steps.map(act => {
                                    if (!act) return act;
                                    if (act.action === 'run_command' || act.action === 'execute') act.action = 'command';
                                    if (act.action === 'command' && !act.parameter && !act.cmd && !act.command) {
                                        if (act.params && act.params.command) act.parameter = act.params.command;
                                    }
                                    return act;
                                });
                                
                                parsed.actions.push(...steps);
                            } catch (err) { }
                        }
                    }
                }
            } else if (type === 'REPLY') {
                parsed.reply = content;
            }
        }
        
        if (!hasStructuredData) parsed.reply = raw.replace(/GOLEM_\w+/g, '').trim();
        return parsed;
    }

    static extractJson(text) {
        if (!text) return [];
        try {
            const match = text.match(/```json([\s\S]*?)```/);
            if (match) return JSON.parse(match[1]).steps || JSON.parse(match[1]);
            const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (arrayMatch) return JSON.parse(arrayMatch[0]);
        } catch (e) { console.error("解析 JSON 失敗:", e.message); }
        return [];
    }
}

module.exports = ResponseParser;
