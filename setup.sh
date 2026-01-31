#!/bin/bash

# ========================================================
# 🦞 Golem v7.1 (Tri-Brain Ultimate) Setup Script
# ========================================================

echo "========================================================"
echo "      🦞 Golem v7.1 (Tri-Brain Ultimate) 安裝精靈"
echo "========================================================"
echo ""

# 1. 檢查 Node.js 環境
echo "🔍 [1/5] 正在檢查 Node.js 環境..."
if ! command -v node &> /dev/null; then
    echo "❌ [錯誤] 未偵測到 Node.js！"
    echo "請前往 https://nodejs.org/ 下載並安裝 LTS 版本，或使用 nvm 安裝。"
    exit 1
fi
echo "   ✅ Node.js 已安裝 ($(node -v))。"

# 2. 清理舊環境 (確保移除 Ollama 殘留)
echo ""
echo "🧹 [2/5] 清理舊依賴與緩存..."
if [ -d "node_modules" ]; then
    echo "   - 正在刪除舊的 node_modules..."
    rm -rf node_modules
fi
if [ -f "package-lock.json" ]; then
    echo "   - 正在刪除舊的 package-lock.json..."
    rm package-lock.json
fi
echo "   ✅ 環境清理完成。"

# 3. 安裝新依賴
echo ""
echo "📦 [3/5] 正在下載 Golem v7.1 核心組件..."
echo "   (這可能需要幾分鐘，請稍候...)"
npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ [錯誤] npm install 失敗！請檢查網路連線或權限。"
    exit 1
fi
echo "   ✅ 依賴安裝完成。"

# 4. 初始化記憶體與設定檔
echo ""
echo "🧠 [4/5] 初始化神經網路記憶體..."

# 建立記憶體目錄
if [ ! -d "golem_memory" ]; then
    mkdir golem_memory
    echo "   - 建立 golem_memory 資料夾"
fi

# 初始化 JSON 檔案
if [ ! -f "golem_persona.json" ]; then
    echo "{}" > golem_persona.json
fi
if [ ! -f "golem_learning.json" ]; then
    echo "{}" > golem_learning.json
fi

# 建立/檢查 .env
if [ ! -f ".env" ]; then
    echo "   - 未偵測到 .env，正在建立預設設定檔..."
    cat << EOF > .env
# ==========================================
# 🤖 Golem v7.1 環境配置檔
# ==========================================

# 1. Google Gemini API Keys (維修技師與自癒機制用)
# 支援多組 Key 輪動，請用逗號分隔 (無空格)
GEMINI_API_KEYS=填入你的Key1,填入你的Key2

# 2. Telegram Bot Token
TELEGRAM_TOKEN=填入你的BotToken

# 3. 管理員 ID (安全性設定)
ADMIN_ID=填入你的TelegramID

# 4. 記憶體儲存路徑
USER_DATA_DIR=./golem_memory

# 5. 測試模式
GOLEM_TEST_MODE=false
EOF
    echo "   ⚠️ 已建立 .env 檔案，請記得填入 API Key！"
else
    echo "   ✅ .env 設定檔已存在。"
fi

# 5. 完成
echo ""
echo "========================================================"
echo "      🎉 Golem v7.1 部署就緒！"
echo "========================================================"
echo ""
echo "[下一步指引]"
echo "1. 請使用編輯器打開 .env 檔案 (例如: nano .env)"
echo "2. 填入 GEMINI_API_KEYS (必要！)"
echo "3. 填入 TELEGRAM_TOKEN (必要！)"
echo "4. 填入 ADMIN_ID (建議)"
echo ""
echo "設定完成後，請執行: npm start"
echo ""
