const path = require('path');

// ============================================================
// 🧠 Memory Drivers (雙模記憶驅動 + 排程擴充 + 物理清空)
// ============================================================
class BrowserMemoryDriver {
    constructor(brain) { this.brain = brain; }
    async init() {
        if (this.brain.memoryPage) return;
        try {
            this.brain.memoryPage = await this.brain.browser.newPage();
            // When using Remote Chrome (host browser), paths must be host-side.
            // HOST_PROJECT_DIR tells us where the project lives on the host.
            const baseDir = process.env.HOST_PROJECT_DIR || process.cwd();
            const memoryPath = 'file:///' + path.join(baseDir, 'memory.html').replace(/\\/g, '/');
            console.log(`🧠 [Memory:Browser] 正在掛載神經海馬迴: ${memoryPath}`);
            await this.brain.memoryPage.goto(memoryPath);
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) { console.error("❌ [Memory:Browser] 啟動失敗:", e.message); }
    }
    async recall(query) {
        if (!this.brain.memoryPage) return [];
        return await this.brain.memoryPage.evaluate(async (txt) => {
            return window.queryMemory ? await window.queryMemory(txt) : [];
        }, query);
    }
    async memorize(text, metadata) {
        if (!this.brain.memoryPage) return;
        await this.brain.memoryPage.evaluate(async (t, m) => {
            if (window.addMemory) await window.addMemory(t, m);
        }, text, metadata);
    }
    async addSchedule(task, time) {
        if (!this.brain.memoryPage) return;
        await this.brain.memoryPage.evaluate(async (t, time) => {
            if (window.addSchedule) await window.addSchedule(t, time);
        }, task, time);
    }
    async checkDueTasks() {
        if (!this.brain.memoryPage) return [];
        return await this.brain.memoryPage.evaluate(async () => {
            return window.checkSchedule ? await window.checkSchedule() : [];
        });
    }

    // ✨ [新增] 物理清空整個 Memory DB
    async clearMemory() {
        if (!this.brain.memoryPage) return;
        try {
            await this.brain.memoryPage.evaluate(async () => {
                if (window.clearAllMemory) await window.clearAllMemory();
            });
            console.log("🗑️ [Memory:Browser] IndexedDB 已被物理清空。");
        } catch (e) {
            console.error("❌ [Memory:Browser] 清空 DB 失敗:", e.message);
        }
    }
}

module.exports = BrowserMemoryDriver;
