/**
 * 檔案名稱: dashboard.js
 * 版本: v8.5 (Neuro-Link Monitor Edition)
 * ---------------------------------------
 * 更新重點：
 * 1. 支援 Neuro-Link 雙軌訊號的色彩高亮 (CDP vs DOM)。
 * 2. 狀態面板新增 Neuro-Link 狀態指示。
 */
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const os = require('os');

class DashboardPlugin {
    constructor() {
        // 1. 保存原始的 Console 方法
        this.originalLog = console.log;
        this.originalError = console.error;
        this.isDetached = false;

        // 2. 初始化螢幕
        this.screen = blessed.screen({
            smartCSR: true,
            title: '🦞 Golem v8.5 戰術控制台 (Neuro-Link)',
            fullUnicode: true
        });

        // 3. 建立網格
        this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

        // --- 介面元件佈局 ---

        // 左上：系統負載
        this.cpuLine = this.grid.set(0, 0, 4, 6, contrib.line, {
            style: { line: "yellow", text: "green", baseline: "black" },
            label: '⚡ 系統負載 (RAM/CPU)',
            showLegend: true
        });

        // 左下：核心日誌 (升級：支援 Neuro-Link 高亮)
        this.logBox = this.grid.set(4, 0, 7, 6, contrib.log, {
            fg: "green",
            selectedFg: "lightgreen",
            label: '📠 神經網路日誌 (Neuro-Link Logs)',
            tags: true // 啟用顏色標籤解析
        });

        // 右上：狀態面板
        this.statusBox = this.grid.set(0, 6, 4, 6, contrib.markdown, {
            label: '🧠 引擎狀態',
            style: { border: { fg: 'cyan' } }
        });

        // 右下：三流協定
        this.chatBox = this.grid.set(4, 6, 7, 6, contrib.log, {
            fg: "white",
            selectedFg: "cyan",
            label: '💬 三流協定 (對話/行動)'
        });

        // --- 底部說明列 ---
        this.footer = blessed.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            content: ' {bold}F12{/bold}: 關閉畫面(不停止程式) | {bold}Ctrl+C{/bold}: 完全停止 | {bold}v8.5 Neuro-Link{/bold} ',
            style: { fg: 'black', bg: 'cyan' },
            tags: true
        });

        // 數據容器
        this.memData = { title: 'RAM (MB)', x: Array(10).fill(' '), y: Array(10).fill(0), style: { line: 'red' } };

        // 啟動攔截
        this.setupOverride();
        this.startMonitoring();
        this.setupKeys();

        this.screen.render();
    }

    // 設定按鍵監聽
    setupKeys() {
        this.screen.key(['C-c', 'q'], () => {
            this.screen.destroy();
            console.log = this.originalLog;
            console.error = this.originalError; // 修正變數名稱錯誤
            console.log("🛑 Golem 系統已完全終止。");
            process.exit(0);
        });

        this.screen.key(['f12'], () => {
            this.detach();
        });
    }

    // 核心：劫持 console (v8.5 增強版)
    setupOverride() {
        console.log = (...args) => {
            if (this.isDetached) return this.originalLog(...args);

            let msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');

            // --- v8.5 Neuro-Link 色彩增強邏輯 ---
            let logMsg = msg;
            
            // 1. CDP 網路層訊號 (Cyan/Blue)
            if (msg.includes('[CDP]')) {
                logMsg = `{cyan-fg}${msg}{/cyan-fg}`;
            }
            // 2. DOM 視覺層訊號 (Yellow)
            else if (msg.includes('[DOM]') || msg.includes('[F12]')) {
                logMsg = `{yellow-fg}${msg}{/yellow-fg}`;
            }
            // 3. Brain 決策訊號 (Magenta)
            else if (msg.includes('[Brain]')) {
                logMsg = `{magenta-fg}${msg}{/magenta-fg}`;
            }
            // 4. OpticNerve 視覺訊號 (Blue)
            else if (msg.includes('[OpticNerve]') || msg.includes('[Vision]')) {
                logMsg = `{blue-fg}${msg}{/blue-fg}`;
            }

            // 寫入日誌面板
            if (this.logBox) this.logBox.log(logMsg);

            // 分流邏輯 (ChatBox)
            if (msg.includes('[💬 REPLY]') || msg.includes('—-回覆開始—-')) {
                const text = msg.replace('[💬 REPLY]', '').replace('—-回覆開始—-','').substring(0, 60);
                if (this.chatBox) this.chatBox.log(`\x1b[36m[回覆]\x1b[0m ${text}...`);
            }
            else if (msg.includes('[🤖 ACTION_PLAN]')) {
                if (this.chatBox) this.chatBox.log(`\x1b[33m[行動]\x1b[0m 偵測到指令`);
            }
            else if (msg.includes('[🧠 MEMORY_IMPRINT]')) {
                if (this.chatBox) this.chatBox.log(`\x1b[35m[記憶]\x1b[0m 寫入記憶`);
            }
        };

        console.error = (...args) => {
            if (this.isDetached) return this.originalError(...args);
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
            if (this.logBox) this.logBox.log(`{red-fg}[錯誤] ${msg}{/red-fg}`);
        };
    }

    detach() {
        this.isDetached = true;
        this.screen.destroy();
        console.log = this.originalLog;
        console.error = this.originalError;
        console.log("\n============================================");
        console.log("📺 Dashboard 已關閉 (Visual Interface Detached)");
        console.log("🤖 Golem 仍在背景執行中...");
        console.log("============================================\n");
    }

    startMonitoring() {
        this.timer = setInterval(() => {
            if (this.isDetached) return clearInterval(this.timer);

            const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
            this.memData.y.shift();
            this.memData.y.push(memUsage);
            this.cpuLine.setData([this.memData]);

            const mode = process.env.GOLEM_MEMORY_MODE || 'Browser';
            const uptime = Math.floor(process.uptime());
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);

            // 狀態面板更新 (加入 Neuro-Link 狀態)
            this.statusBox.setMarkdown(`
# 核心狀態
- **模式**: ${mode}
- **記憶體**: ${memUsage.toFixed(0)} MB
- **運行**: ${hours}h ${minutes}m
- **連結**: 🟢 Neuro-Link (Dual)
`);
            this.screen.render();
        }, 1000);
    }
}

module.exports = new DashboardPlugin();
