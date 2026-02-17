#!/bin/bash

# ==========================================
# Project Golem v9.0 (Titan Chronos) - Linux/macOS
# ==========================================

# --- 顏色定義 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- 核心：跨平台 .env 更新函數 ---
update_env() {
    local key=$1
    local val=$2
    # 處理特殊字符，避免 sed 報錯
    val=$(echo "$val" | sed -e 's/[\/&]/\\&/g')

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS 需要空的備份參數
        sed -i '' "s|^$key=.*|$key=$val|" .env
    else
        # Linux 直接替換
        sed -i "s|^$key=.*|$key=$val|" .env
    fi
}

# --- 介面顯示 ---
show_header() {
    clear
    echo -e "${CYAN}=======================================================${NC}"
    echo -e "${CYAN} 🤖 Project Golem v9.0 (Titan Chronos) Master Control${NC}"
    echo -e "${CYAN}=======================================================${NC}"
    echo ""
}

# ==========================================
# 主選單
# ==========================================
show_menu() {
    show_header
    echo -e " 請選擇操作模式："
    echo ""
    echo -e " [0] ⚡ 啟動系統 (Start System)"
    echo -e "     (啟動 Titan Dashboard 終端機介面)"
    echo -e " -------------------------------------------------------"
    echo -e " [1] 🚀 完整安裝與部署 (Full Setup)"
    echo -e " [2] ⚙️ 僅更新配置 (.env Wizard)"
    echo -e " [3] 📦 僅安裝依賴 (Install Dependencies)"
    echo -e " [Q] 🚪 退出"
    echo ""
    read -p " 請輸入選項 (0/1/2/3/Q): " choice

    case $choice in
        0) launch_system ;;
        1) step_check_files; step_check_env; config_wizard; step_install_core; step_final ;;
        2) step_check_env; config_wizard; show_menu ;;
        3) step_install_core; echo -e "${GREEN}安裝完成。${NC}"; exit 0 ;;
        [Qq]) exit 0 ;;
        *) echo -e "${RED}無效選項${NC}"; sleep 1; show_menu ;;
    esac
}

# ==========================================
# 1. 檔案完整性檢查 (V9.0 Titan)
# ==========================================
step_check_files() {
    echo ""
    echo -e "${GREEN}[1/5] 🔍 檢查核心檔案...${NC}"
    # 根據您的 zip 檔內容，這些是 V9.0 的關鍵檔案
    local missing=0
    for file in index.js skills.js package.json dashboard.js memory.html; do
        if [ ! -f "$file" ]; then
            echo -e "${RED}   [ERROR] 缺失檔案: $file${NC}"
            missing=1
        fi
    done

    if [ $missing -eq 1 ]; then
        echo -e "${RED}嚴重錯誤：核心檔案不完整！請確認您已正確解壓縮 V9.0 zip 檔。${NC}"
        exit 1
    fi
    echo -e "   [OK] 檔案完整性檢查通過。"
}

# ==========================================
# 2. 環境變數準備
# ==========================================
step_check_env() {
    echo ""
    echo -e "${GREEN}[2/5] 📄 檢查環境設定檔...${NC}"
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${YELLOW}   [INFO] 已從範本建立 .env 檔案。${NC}"
        else
            echo -e "${RED}   [ERROR] 找不到 .env.example，無法建立配置！${NC}"
            exit 1
        fi
    else
        echo -e "   [OK] .env 檔案已存在。"
    fi
}

# ==========================================
# 3. 配置精靈 (Titan Config)
# ==========================================
config_wizard() {
    clear
    echo -e "${CYAN}=======================================================${NC}"
    echo -e "${CYAN} 🧙 環境變數配置精靈 (Titan Config)${NC}"
    echo -e "${CYAN}=======================================================${NC}"
    echo ""

    # --- Gemini (注意：V9.0 使用 GEMINI_API_KEYS 複數) ---
    echo -e "${YELLOW}[1/2] Google Gemini API Keys (必填)${NC}"
    echo -e " 說明：支援多組 Key 輪詢，請用逗號分隔。"
    while true; do
        read -p " Gemini Keys: " input_gemini
        if [ -n "$input_gemini" ]; then
            update_env "GEMINI_API_KEYS" "$input_gemini"
            break
        else
            echo -e "${RED}   ❌ 此欄位為必填！${NC}"
        fi
    done

    # --- Telegram (注意：V9.0 使用 TELEGRAM_TOKEN 無 BOT_ 前綴) ---
    echo ""
    echo -e "${YELLOW}[2/2] Telegram Bot 設定 (必填)${NC}"
    while true; do
        read -p " Telegram Bot Token: " input_tg
        if [ -n "$input_tg" ]; then
            update_env "TELEGRAM_TOKEN" "$input_tg"
            break
        else
            echo -e "${RED}   ❌ 此欄位為必填！${NC}"
        fi
    done

    # --- Admin ID ---
    while true; do
        read -p " Admin User ID: " input_tg_id
        if [ -n "$input_tg_id" ]; then
            update_env "ADMIN_ID" "$input_tg_id"
            break
        else
            echo -e "${RED}   ❌ 此欄位為必填！${NC}"
        fi
    done

    echo ""
    echo -e "${GREEN}[OK] 配置完成！${NC}"
    sleep 1
}

# ==========================================
# 4. 依賴安裝
# ==========================================
step_install_core() {
    echo ""
    echo -e "${GREEN}[3/5] 📦 安裝核心依賴...${NC}"
    echo -e "      (包含 puppeteer, blessed, gemini-ai...)"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] npm install 失敗，請檢查網路或 Node 版本。${NC}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}[4/5] 確認 Dashboard UI 套件...${NC}"
    # 確保 TUI 套件存在
    if [ ! -d "node_modules/blessed" ]; then
        echo -e "${YELLOW}   [INFO] 補安裝 blessed 介面庫...${NC}"
        npm install blessed blessed-contrib
    fi
}

# ==========================================
# 5. 完成與啟動
# ==========================================
step_final() {
    echo ""
    echo -e "${GREEN}=======================================================${NC}"
    echo -e "${GREEN} 🎉 部署成功！Golem v9.0 (Titan) 已就緒。${NC}"
    echo -e "${GREEN}=======================================================${NC}"
    echo ""
    echo -e " 系統將在 5 秒後自動啟動..."
    echo -e " (按 Ctrl+C 可取消)"
    
    # 倒數計時
    secs=5
    while [ $secs -gt 0 ]; do
       echo -ne " \r⏳ 倒數: $secs 秒... "
       sleep 1
       : $((secs--))
    done
    echo ""
    launch_system
}

# ==========================================
# 啟動系統 (V9.0 TUI Mode)
# ==========================================
launch_system() {
    clear
    echo -e "${CYAN}=======================================================${NC}"
    echo -e "${CYAN} 🚀 正在啟動 Golem v9.0 Dashboard...${NC}"
    echo -e "${CYAN}=======================================================${NC}"
    echo -e " [INFO] 正在載入 Neural Memory 與 blessed 介面..."
    echo -e " [TIPS] 若要離開 Dashboard，請按 'q' 或 Ctrl+C"
    echo ""
    sleep 1

    # 直接在前台執行，因為這是 TUI 介面，不能丟到背景
    npm run dashboard
    
    # 退出後回到選單
    echo ""
    echo -e "${YELLOW}[INFO] 系統已停止。${NC}"
    read -p "按 Enter 返回主選單..."
    show_menu
}

# --- 程式入口 ---
# 檢查權限 (建議)
if [ ! -x "$0" ]; then
    echo -e "${YELLOW}[WARN] 請先執行: chmod +x setup.sh${NC}"
fi

show_menu
