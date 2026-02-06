/**
 * 🛠️ Golem v8.5 Full Patch - Content Diffing Strategy
 * ---------------------------------------------------
 * 適用對象：原版 index.js (v8.5)
 * 功能：
 * 1. 移除不穩定的 preCount (數量檢查)。
 * 2. 注入 staleText (內容指紋) 快照機制。
 * 3. 實作「雙軌監聽 + 內容比對」防止 DOM 重繪導致的死鎖。
 * 4. 修復安全柵欄 (Safety Barrier) 以匹配新的指紋變數。
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.join(process.cwd(), 'index.js');
const BACKUP_FILE = path.join(process.cwd(), 'index.js.original_bak');

console.log("🔍 正在初始化全量修補程序 (Target: Original v8.5)...");

if (!fs.existsSync(TARGET_FILE)) {
    console.error("❌ 找不到 index.js");
    process.exit(1);
}

// 建立備份
if (!fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
    console.log(`📦 已建立原版備份: ${BACKUP_FILE}`);
}

let content = fs.readFileSync(TARGET_FILE, 'utf-8');

// ============================================================
// 🎯 定位原版函數特徵
// ============================================================
// 原版代碼中 tryInteract 的開頭
const ORIG_START_MARKER = "const tryInteract = async (sel, retryCount = 0) => {";
// 原版代碼中 tryInteract 結束後的呼叫 (作為邊界)
const ORIG_END_MARKER = "return await tryInteract(this.selectors);";

const startIndex = content.indexOf(ORIG_START_MARKER);
const endIndex = content.indexOf(ORIG_END_MARKER);

if (startIndex === -1 || endIndex === -1) {
    console.error("❌ 無法定位原版 tryInteract 函數區塊。");
    console.error("   請確認您的 index.js 是否為 v8.5 原版，或是否已被修改過。");
    process.exit(1);
}

// 擷取原本的區塊 (用於驗證與替換)
// 我們要替換的是從 tryInteract 定義開始，直到上面的 try { return await tryInteract... 之前
// 往回找最近的一個閉合括號 '};'
const blockEndIndex = content.lastIndexOf("};", endIndex);
if (blockEndIndex < startIndex) {
     console.error("❌ 代碼結構解析失敗 (End brace mismatch)。");
     process.exit(1);
}

// ============================================================
// 💉 建構新的函數邏輯 (包含所有修復)
// ============================================================
const NEW_FUNCTION_CODE = `const tryInteract = async (sel, retryCount = 0) => {
    try {
      // 1. 檢查輸入框是否存在
      const inputExists = await this.page.$(sel.input);
      if (!inputExists) throw new Error(\`找不到輸入框: \${sel.input}\`);

      // 🔥 [Patch] 內容指紋快照 (Snapshot Stale Text)
      // 用來對付 DOM 重繪問題，確保我們能分辨什麼是「舊訊息」
      const staleText = await this.page.evaluate((s) => {
        const bubbles = document.querySelectorAll(s);
        // 如果畫面是空的，回傳特殊標記，保證第一則訊息能通過比對
        return bubbles.length ? bubbles[bubbles.length - 1].innerText : "___START___";
      }, sel.response);

      console.log(\`🔒 [Brain] 鎖定舊回應 (Fingerprint: \${staleText.substring(0, 10)}...)\`);

      // 輸入文字
      await this.page.evaluate((s, t) => {
        const el = document.querySelector(s);
        el.focus();
        document.execCommand('insertText', false, t);
      }, sel.input, text);

      await new Promise(r => setTimeout(r, 800));
      // 點擊發送
      try {
        await this.page.waitForSelector(sel.send, { timeout: 2000 });
        await this.page.click(sel.send);
      } catch (e) {
        await this.page.keyboard.press('Enter');
      }

      if (isSystem) { await new Promise(r => setTimeout(r, 2000)); return ""; }

      // ✨ [Neuro-Link] 啟動雙軌並行監聽 (Racing Mode)
      console.log("⚡ [Brain] 啟動雙軌監聽 (Dual-Track: CDP + Content Diff)...");
      let isFinished = false;

      // 🏃 選手 A: CDP 網路監聽
      const cdpRacer = new Promise((resolve) => {
        const TARGET_URL_PATTERN = /batchexecute/i;
        let targetRequestId = null;

        const onRequest = (e) => {
          if (isFinished) return;
          if (TARGET_URL_PATTERN.test(e.request.url) && e.request.method === 'POST') {
            targetRequestId = e.requestId;
            console.log(\`📡 [CDP] 鎖定神經訊號: \${e.requestId}\`);
          }
        };

        const onFinished = (e) => {
          if (isFinished) return;
          if (e.requestId === targetRequestId) {
            console.log(\`✅ [CDP] 網路傳輸完畢 (Winner)\`);
            setTimeout(() => resolve('CDP_WIN'), 800); // 渲染緩衝
          }
        };

        this.cdpSession.on('Network.requestWillBeSent', onRequest);
        this.cdpSession.on('Network.loadingFinished', onFinished);
      });

      // 🏃 選手 B: DOM 輪詢 (改用內容比對)
      const domRacer = new Promise((resolve) => {
        const checkLoop = async () => {
          const start = Date.now();
          while (!isFinished) {
            if (Date.now() - start > 120000) { // 120s Timeout
              console.warn("⚠️ [DOM] 等待超時");
              resolve('TIMEOUT');
              break;
            }
            try {
              // 取得當前畫面上的最後一句話
              const currentText = await this.page.evaluate((s) => {
                const bubbles = document.querySelectorAll(s);
                return bubbles.length ? bubbles[bubbles.length - 1].innerText : "";
              }, sel.response);

              // 比對：內容變了 且 包含結束標記
              if (currentText !== staleText && currentText.includes('—-回覆結束—-')) {
                console.log(\`✅ [DOM] 視覺確認結束 (Winner) - Content Updated\`);
                resolve('DOM_WIN');
                break;
              }
              // 比對：內容變了 且 是代碼區塊
              if (currentText !== staleText && currentText.trim().endsWith('\`\`\`')) {
                await new Promise(r => setTimeout(r, 1000));
                resolve('DOM_WIN_CODE');
                break;
              }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1000));
          }
        };
        checkLoop();
      });

      // 🏁 比賽開始
      const winner = await Promise.race([cdpRacer, domRacer]);
      isFinished = true; // 鎖定旗標
      console.log(\`🏁 [Brain] 回應接收完成 (由 \${winner} 觸發)\`);

      // 🛡️ [Safety Barrier] 安全柵欄
      // 確保即使 CDP 贏了，DOM 也真的更新了，避免抓到舊資料
      try {
        await this.page.waitForFunction(
            (s, stale) => {
                const bubbles = document.querySelectorAll(s);
                const curr = bubbles.length ? bubbles[bubbles.length - 1].innerText : "";
                return curr !== stale && curr.includes('—-回覆結束—-');
            },
            { timeout: 8000, polling: 200 },
            sel.response,
            staleText // 傳入正確的指紋變數
        );
      } catch (e) {
        console.warn("⚠️ [Brain] DOM Sync Timeout (Fallback to current data)");
      }

      // 解析回應
      return await this.page.evaluate((s) => {
        const bubbles = document.querySelectorAll(s);
        if (!bubbles.length) return "";
        let rawText = bubbles[bubbles.length - 1].innerText;
        return rawText.replace('—-回覆開始—-', '').replace('—-回覆結束—-', '').trim();
      }, sel.response);

    } catch (e) {
      // 🚑 自癒邏輯 (DOM Doctor) - 保留原版邏輯
      console.warn(\`⚠️ [Brain] 操作失敗: \${e.message}\`);
      if (retryCount === 0) {
        console.log("🚑 [Brain] 呼叫 DOM Doctor 進行緊急手術...");
        const htmlDump = await this.page.content();
        const isInputBroken = e.message.includes('找不到輸入框');

        const newSelector = await this.doctor.diagnose(
          htmlDump,
          isInputBroken ? 'Chat Input Box (contenteditable div)' : 'Chat Message Bubble (text content)'
        );
        if (newSelector) {
          if (isInputBroken) this.selectors.input = newSelector;
          else this.selectors.response = newSelector;
          this.doctor.saveSelectors(this.selectors);
          console.log("🔄 [Brain] 手術完成，正在重試...");
          return await tryInteract(this.selectors, retryCount + 1);
        }
      }
      throw e;
    }
  }`;

// ============================================================
// 💾 執行替換
// ============================================================
const beforeCode = content.substring(0, startIndex);
const afterCode = content.substring(blockEndIndex + 2); // +2 是跳過 "};"

const newContent = beforeCode + NEW_FUNCTION_CODE + afterCode;

try {
    fs.writeFileSync(TARGET_FILE, newContent, 'utf-8');
    console.log("\n✅ 全量修補完成！");
    console.log("   - 已移除 preCount 邏輯");
    console.log("   - 已植入 staleText 指紋比對");
    console.log("   - 已修復 Safety Barrier");
    console.log("\n🚀 請輸入 npm start 啟動 Golem");
} catch (e) {
    console.error("❌ 寫入失敗:", e.message);
}
