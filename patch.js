/**
 * 🛠️ Golem v8.5 Hotfix Patch - Sync Repair
 * ---------------------------------------------------
 * 目的：修復 "Race Condition" 導致的回應慢一步問題 (Off-by-one error)
 * 原理：引入 DOM 數量檢查柵欄，確保讀取的是最新生成的氣泡。
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.join(process.cwd(), 'index.js');
const BACKUP_FILE = path.join(process.cwd(), 'index.js.bak');

console.log("🔍 正在初始化修補程序...");

// 1. 檢查檔案是否存在
if (!fs.existsSync(TARGET_FILE)) {
    console.error("❌ 找不到 index.js，請確保腳本在專案根目錄執行。");
    process.exit(1);
}

// 2. 建立備份
try {
    fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
    console.log(`📦 已建立備份: ${BACKUP_FILE}`);
} catch (e) {
    console.error("❌ 備份失敗:", e.message);
    process.exit(1);
}

// 3. 讀取原始代碼
let content = fs.readFileSync(TARGET_FILE, 'utf-8');

// ==========================================
// 🩹 Patch 1: 修改 DOM 輪詢邏輯 (加入 preCount 檢查)
// ==========================================
// 目標：找到 domRacer 裡面的 evaluate 區塊
// 原始代碼特徵 (使用正則忽略空白與換行):
const SEARCH_PATTERN_1 = /const\s+text\s*=\s*await\s*this\.page\.evaluate\(\s*\(s\)\s*=>\s*\{\s*const\s+bubbles\s*=\s*document\.querySelectorAll\(s\);\s*return\s+bubbles\.length\s*\?\s*bubbles\[bubbles\.length\s*-\s*1\]\.innerText\s*:\s*"";\s*\}\s*,\s*sel\.response\);/gm;

const REPLACE_CODE_1 = `const text = await this.page.evaluate((s, pCount) => {
                        const bubbles = document.querySelectorAll(s);
                        // [Patch] 如果數量沒變，代表新訊息還沒渲染出來，回傳空字串讓它繼續等
                        if (bubbles.length <= pCount) return "";
                        return bubbles[bubbles.length - 1].innerText;
                    }, sel.response, preCount);`;

if (SEARCH_PATTERN_1.test(content)) {
    content = content.replace(SEARCH_PATTERN_1, REPLACE_CODE_1);
    console.log("✅ [1/2] DOM 輪詢邏輯已優化 (加入數量柵欄)");
} else {
    console.warn("⚠️ [1/2] 找不到目標代碼區塊 A，可能已經修補過或代碼被修改。");
}

// ==========================================
// 🩹 Patch 2: 修改 Race 結束後的等待邏輯
// ==========================================
// 目標：在 Promise.race 後面加入 waitForFunction 雙重保險
const SEARCH_PATTERN_2 = /const\s+winner\s*=\s*await\s*Promise\.race\(\[cdpRacer,\s*domRacer\]\);\s*isFinished\s*=\s*true;\s*\/\/\s*鎖定旗標\s*console\.log\(`🏁\s*\[Brain\]\s*回應接收完成\s*\(由\s*\$\{winner\}\s*觸發\)`\);/gm;

const REPLACE_CODE_2 = `const winner = await Promise.race([cdpRacer, domRacer]);
                    isFinished = true; // 鎖定旗標
                    console.log(\`🏁 [Brain] 回應接收完成 (由 \${winner} 觸發)\`);

                    // 🛡️ [Patch] Safety Barrier: 即使 CDP 贏了，也要確保 DOM 已經渲染出來
                    try {
                        await this.page.waitForFunction(
                            (s, c) => document.querySelectorAll(s).length > c,
                            { timeout: 5000, polling: 200 },
                            sel.response,
                            preCount
                        );
                    } catch (e) {
                        console.warn("⚠️ [Brain] DOM Sync Timeout (使用現有數據)");
                    }`;

if (SEARCH_PATTERN_2.test(content)) {
    content = content.replace(SEARCH_PATTERN_2, REPLACE_CODE_2);
    console.log("✅ [2/2] 競速結算邏輯已優化 (加入延遲保護)");
} else {
    console.warn("⚠️ [2/2] 找不到目標代碼區塊 B，可能已經修補過。");
}

// 4. 寫回檔案
try {
    fs.writeFileSync(TARGET_FILE, content, 'utf-8');
    console.log("\n🎉 修補完成！請重新啟動 Golem (npm start)。");
} catch (e) {
    console.error("❌ 寫入失敗:", e.message);
}
