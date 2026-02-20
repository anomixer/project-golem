const fs = require('fs');
const path = require('path');

// 1. 取得 Golem 傳入的摘要 (跳過 'node' 和 '腳本路徑')
// 將所有後續參數組合回一個完整的字串
const summaryArgs = process.argv.slice(2);
const summary = summaryArgs.join(' ');

// 2. 防呆機制：確保有傳入摘要
if (!summary || summary.trim() === '') {
    console.error("❌ 轉生失敗：沒有提供記憶摘要！");
    console.error("用法範例: node skills/reincarnate.js \"這是一段對話重點摘要...\"");
    process.exit(1);
}

// 3. 準備信號資料
const signalData = {
    timestamp: Date.now(),
    summary: summary.trim()
};

const signalPath = path.join(process.cwd(), '.reincarnate_signal.json');

try {
    // 4. 寫入信號檔案 (這會瞬間觸發 index.js 的監聽器)
    fs.writeFileSync(signalPath, JSON.stringify(signalData, null, 2), 'utf-8');
    
    // 5. 輸出成功訊息 (這個訊息會透過 Executor 回傳給 Golem 和使用者)
    console.log("✅ 記憶摘要已成功封裝！");
    console.log("🚀 轉生信號已發射！主腦即將接手並重啟 Web 會話...");
    console.log("----------------------------------------");
    console.log("【記憶封裝預覽】");
    // 只印出前 150 個字作為預覽，避免終端機洗版
    console.log(summary.substring(0, 150) + (summary.length > 150 ? "..." : ""));
    console.log("----------------------------------------");
    
} catch (error) {
    console.error("❌ 發射轉生信號失敗:", error.message);
    process.exit(1);
}
