// 檔案名稱: dashboard.js
// 版本: v2.0 (含熱切換與說明列)
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const os = require('os');

class DashboardPlugin {
    constructor() {
        // 1. 保存原始的 Console 方法 (為了之後還原)
        this.originalLog = console.log;
        this.originalError = console.error;
        this.isDetached = false;

        // 2. 初始化螢幕
        this.screen = blessed.screen({
            smartCSR: true,
            title: '🦞 Golem v8.2 戰術控制台',
            fullUnicode: true // 確保中文顯示正常
        });

        // 3. 建立網格 (留最下面一行給說明列，所以 rows 設為 12，但主要元件只用到 11)
        this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

        // --- 介面元件佈局 ---

        // 左上：系統負載
        this.cpuLine = this.grid.set(0, 0, 4, 6, contrib.line, {
            style: { line: "yellow", text: "green", baseline: "black" },
            label: '⚡ 系統負載 (RAM/CPU)',
            showLegend: true
        });

        // 左下：系統日誌 (高度縮減 1 格給 footer)
        this.logBox = this.grid.set(4, 0, 7, 6, contrib.log, {
            fg: "green",
            selectedFg: "lightgreen",
            label: '📠 核心日誌 (System Logs)'
        });

        // 右上：狀態面板
        this.statusBox = this.grid.set(0, 6, 4, 6, contrib.markdown, {
            label: '🧠 引擎狀態',
            style: { border: { fg: 'cyan' } }
        });

        // 右下：三流協定 (高度縮減 1 格給 footer)
        this.chatBox = this.grid.set(4, 6, 7, 6, contrib.log, {
            fg: "white",
            selectedFg: "cyan",
            label: '💬 三流協定 (對話/行動)'
        });

        // --- 底部說明列 (Footer) ---
        this.footer = blessed.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            content: ' {bold}F12{/bold}: 關閉畫面(不停止程式) | {bold}Ctrl+C{/bold}: 完全停止程式 | {bold}Dashboard v2.0{/bold} ',
            style: {
                fg: 'black',
                bg: 'cyan'
            },
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
        // 1. 完全停止 (Kill Process)
        this.screen.key(['C-c', 'q'], () => {
            this.screen.destroy();
            console.log = this.originalLog; // 恢復 console 以免報錯
            console.log("🛑 Golem 系統已完全終止。");
            process.exit(0);
        });

        // 2. 熱切換 (Detach UI) - 關閉畫面但保留程式
        this.screen.key(['f12'], () => {
            this.detach();
        });
    }

    // 核心：劫持 console
    setupOverride() {
        console.log = (...args) => {
            if (this.isDetached) return this.originalLog(...args); // 如果已脫離，直接用原本的

            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
            
            // 寫入 Dashboard 元件
            if (this.logBox) this.logBox.log(msg);

            // 分流邏輯
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
            if (this.logBox) this.logBox.log(`\x1b[31m[錯誤]\x1b[0m ${msg}`);
        };
    }

    // 脫離模式：銷毀 UI 並還原 Console
    detach() {
        this.isDetached = true;
        this.screen.destroy(); // 銷毀 blessed 實例
        
        // 還原原生 console
        console.log = this.originalLog;
        console.error = this.originalError;

        console.log("\n============================================");
        console.log("📺 Dashboard 已關閉 (Visual Interface Detached)");
        console.log("🤖 Golem 仍在背景執行中...");
        console.log("============================================\n");
    }

    startMonitoring() {
        this.timer = setInterval(() => {
            if (this.isDetached) return clearInterval(this.timer); // 脫離後停止更新 UI

            const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
            this.memData.y.shift();
            this.memData.y.push(memUsage);
            this.cpuLine.setData([this.memData]);
            
            const mode = process.env.GOLEM_MEMORY_MODE || 'Browser';
            const uptime = Math.floor(process.uptime());
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            this.statusBox.setMarkdown(`
# 核心狀態
- **模式**: ${mode}
- **記憶體**: ${memUsage.toFixed(0)} MB
- **運行**: ${hours}h ${minutes}m
            `);
            this.screen.render();
        }, 1000);
    }
}

module.exports = new DashboardPlugin();
