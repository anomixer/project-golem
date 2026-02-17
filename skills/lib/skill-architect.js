// File: lib/skill-architect.js
const fs = require('fs');
const path = require('path');

class SkillArchitect {
    /**
     * @param {Object} model - Gemini 模型實例 (GenerativeModel)
     * @param {string} skillsDir - 使用者技能存放目錄
     */
    constructor(model, skillsDir) {
        this.model = model;
        this.skillsDir = skillsDir || path.join(process.cwd(), 'skills', 'user');
        
        // 確保目錄存在
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }

    /**
     * 生成並儲存新技能
     * @param {string} intent - 使用者想要的功能描述
     * @param {Array} existingSkills - 當前已存在的技能列表 (用於查重)
     */
    async designSkill(intent, existingSkills = []) {
        console.log(`🏗️ Architect: Designing skill for "${intent}"...`);

        // 1. 建構 System Prompt (嚴格規範 v9.0 標準)
        const systemPrompt = `
        You are the Senior Skill Architect for Golem v9.0.
        Your task is to generate a robust, production-ready Node.js skill module based on the user's request.
        
        ### CONTEXT & API
        - **Environment**: Node.js + Puppeteer.
        - **Input**: The 'run' function receives (ctx, args).
        - **CTX Object**: { page (PuppeteerPage), browser, log (Logger), io (Input/Output), metadata }.
        - **Logging**: Use ctx.log.info(), ctx.log.warn(), ctx.log.error(). NEVER use console.log.
        - **Interactivity**: If you need user input, use 'await ctx.io.ask("question")'.
        
        ### STRICT OUTPUT FORMAT (JSON ONLY)
        You must output a single JSON object. Do not wrap in markdown code blocks.
        Structure:
        {
            "filename": "skill-name-kebab-case.js",
            "name": "SKILL_NAME_UPPERCASE",
            "description": "Short description of what it does",
            "tags": ["#user-generated", "#v9", "#tag"],
            "code": "Full JavaScript code string..."
        }

        ### CODE TEMPLATE (Inject this structure into the 'code' field)
        module.exports = {
            name: "SKILL_NAME",
            description: "...",
            version: "1.0.0",
            tags: ["#user-generated"],
            // The main execution function
            run: async (ctx, args) => {
                const { page, log, io } = ctx;
                try {
                    log.info("🚀 Starting Skill: SKILL_NAME");
                    
                    // --- YOUR LOGIC HERE ---
                    // Example: await page.goto('...');
                    
                    log.info("✅ Skill completed successfully.");
                    return "Execution finished.";
                } catch (err) {
                    log.error("❌ Error in Skill", err);
                    throw err; // Re-throw to let the system handle the error state
                }
            }
        };

        ### RULES
        1. **Security**: NO 'child_process', NO 'fs' write operations (read is okay), NO 'eval'.
        2. **Robustness**: Always wrap main logic in try/catch.
        3. **Puppeteer**: Assume 'page' is already active. Do not close the browser.
        `;

        // 2. 呼叫 Gemini
        try {
            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: systemPrompt + `\n\nUSER REQUEST: ${intent}` }] }]
            });
            
            let responseText = result.response.text();
            
            // 清理可能存在的 Markdown 標記
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // 3. 解析 JSON
            const skillData = JSON.parse(responseText);

            // 4. 驗證與存檔
            if (!skillData.filename || !skillData.code) {
                throw new Error("Invalid generation: Missing filename or code.");
            }

            const filePath = path.join(this.skillsDir, skillData.filename);
            
            // 防止意外覆蓋 (可選：如果要允許覆蓋請移除此檢查)
            if (fs.existsSync(filePath)) {
                // 自動重新命名
                const timestamp = Date.now();
                skillData.filename = skillData.filename.replace('.js', `-${timestamp}.js`);
            }

            const finalPath = path.join(this.skillsDir, skillData.filename);
            fs.writeFileSync(finalPath, skillData.code);

            return { 
                success: true, 
                path: finalPath, 
                name: skillData.name, 
                preview: skillData.description 
            };

        } catch (error) {
            console.error("❌ Architect Error:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SkillArchitect;
