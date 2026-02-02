@echo off
setlocal
chcp 65001 >nul
title Golem V8.0 Setup - Neural Memory Edition

echo ========================================================
echo   🦞 Golem v8.0 環境部署工具 (Neural Memory)
echo   目標：Telegram + Discord + 本地向量海馬迴
echo   架構：Node.js 反射層 + Puppeteer (Transformers.js)
echo ========================================================
echo.

:: 1. 檢查 Node.js 環境
echo 🔍 [1/6] 正在檢查 Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [錯誤] 未偵測到 Node.js！
    echo 請前往 https://nodejs.org/ 下載並安裝 (建議 v18 以上)。
    pause
    exit /b
)
echo    ✅ Node.js 已就緒。

:: 2. 檢查使用者提供的原始碼 (v8.0 關鍵步驟)
echo.
echo 📂 [2/6] 驗證核心檔案...

:: 檢查 index.js
if not exist index.js (
    color 0C
    echo.
    echo [嚴重錯誤] 找不到 index.js！
    echo 請將 v8.0 版本的 index.js 放入此資料夾後再執行。
    echo.
    pause
    exit /b
)
echo    ✅ 偵測到 index.js

:: 檢查 memory.html (v8.0 新增)
if not exist memory.html (
    color 0C
    echo.
    echo [嚴重錯誤] 找不到 memory.html！
    echo 這是 v8.0 的「神經海馬迴」核心檔案，缺少它將無法運作。
    echo 請確保 memory.html 與 index.js 位於同一目錄。
    echo.
    pause
    exit /b
)
echo    ✅ 偵測到 memory.html (神經海馬迴)

:: 檢查 skills.js
if not exist skills.js (
    echo [提示] 找不到 skills.js，若您的版本需要它，請記得放入。
) else (
    echo    ✅ 偵測到 skills.js
)

:: 3. 清理舊環境
echo.
echo 🧹 [3/6] 清理舊依賴...
if exist node_modules (
    echo    - 正在移除舊的 node_modules (確保乾淨安裝)...
    rmdir /s /q node_modules
)
if exist package-lock.json del package-lock.json
echo    ✅ 環境已清理。

:: 4. 安裝依賴 (Project Golem v8.0 標準依賴)
echo.
echo 📦 [4/6] 正在安裝 NPM 依賴...
echo    - 包含: TG/DC SDK, Puppeteer, Gemini AI, UUID...
if not exist package.json call npm init -y >nul

:: 安裝指令
call npm install dotenv node-telegram-bot-api discord.js puppeteer puppeteer-extra puppeteer-extra-plugin-stealth @google/generative-ai uuid
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [錯誤] 安裝失敗，請檢查網路連線。
    pause
    exit /b
)
echo    ✅ 依賴安裝完成。

:: 5. 下載瀏覽器核心
echo.
echo 🌐 [5/6] 設定 Puppeteer Chrome 核心...
echo    - 這是 Transformers.js 與 Web Gemini 的運行容器
call npx puppeteer browsers install chrome
echo    ✅ 瀏覽器核心就緒。

:: 6. 初始化設定檔
echo.
echo 🧠 [6/6] 設定環境參數...

if not exist golem_memory mkdir golem_memory

:: 初始化 JSON 記憶體 (若不存在)
if not exist golem_learning.json echo {} > golem_learning.json

:: 建立 v8.0 版 .env (若不存在)
if not exist .env (
    echo    - 正在建立 v8.0 雙平台 .env 範本...
    (
        echo # ======================================================
        echo # 🧠 Golem Brain ^(Web Gemini API Keys^)
        echo # ======================================================
        echo # 必填：用於自癒、視覺分析 (OpticNerve)
        echo # 支援多組 Key 用逗號分隔，無需付費，申請 Free Tier 即可
        echo GEMINI_API_KEYS=
        echo.
        echo # ======================================================
        echo # ✈️ Telegram 設定 ^(左腦^)
        echo # ======================================================
        echo TELEGRAM_TOKEN=
        echo ADMIN_ID=
        echo.
        echo # ======================================================
        echo # 👾 Discord 設定 ^(右腦^)
        echo # ======================================================
        echo DISCORD_TOKEN=
        echo DISCORD_ADMIN_ID=
        echo.
        echo # ======================================================
        echo # ⚙️ 系統設定
        echo # ======================================================
        echo USER_DATA_DIR=./golem_memory
        echo # 開發者除錯模式 (一般用戶請設為 false)
        echo GOLEM_TEST_MODE=false
        echo # v8.0 更新：不需要設定 HuggingFace Token，模型為本地自動下載
    ) > .env
    echo    ⚠️ .env 已建立，請記得填入 Token！
) else (
    echo    ✅ .env 已存在 (跳過覆蓋)。
)

echo.
echo ========================================================
echo      🎉 v8.0 部署完成！(Neural Memory Ready)
echo ========================================================
echo.
echo [請執行以下步驟]
echo 1. 編輯 .env 檔案，填入 TG/Discord Token 與 Gemini Key。
echo 2. 啟動機器人: node index.js
echo.
echo 注意：第一次啟動時，會自動下載 AI 模型 (約 50MB)，請稍候。
echo.
pause
