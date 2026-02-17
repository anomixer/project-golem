#!/bin/bash

# ==========================================
# Project Golem Manager (Linux/macOS)
# ==========================================

# --- 顏色定義 (ANSI Colors) ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- 輔助函數：更新 .env ---
update_env() {
    local key=$1
    local val=$2
    # 檢測作業系統以處理 sed 語法差異 (macOS vs Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^$key=.*|$key=$val|" .env
    else
        sed -i "s|^$key=.*|$key=$val|" .env
    fi
    echo -e "${GREEN}   -> 已更新 $key${NC}"
}

# --- 標題顯示 ---
show_header() {
    clear
    echo -e "${CYAN}=======================================================${NC}"
    echo -e "${CYAN} Project Golem Master Controller (Linux/macOS)${NC}"
    echo -e "${CYAN}=======================================================${NC}"
    echo ""
}

# ==========================================
# 主選單邏輯
# ==========================================
show_menu() {
    show_header
    echo -e " 請選擇操作模式："
    echo ""
    echo -e " [0] ⚡ 直接啟動系統 (Start System)"
    echo -e " -------------------------------------------------------"
    echo -e " [1] 🚀 完整安裝與部署 (Full Setup)"
    echo -e " [2] ⚙️ 僅更新配置 (.env Wizard)"
    echo -e " [3] 📦 僅安裝依賴 (Install Dependencies)"
    echo -e " [Q] 🚪 退出"
    echo ""
    read -p " 請輸入選項 (0/1/2/3/Q): " choice

    case $choice in
        0) launch_system ;;
        1) step_check_env; config_wizard; step_install_core; step_final ;;
        2) step_check_env; config_wizard; show_menu ;;
        3) step_install_core; echo -e "${GREEN}安裝完成。${NC}"; exit 0 ;;
        [Qq]) exit 0 ;;
        *) echo -e "${RED}無效選項${NC}"; sleep 1; show_menu ;;
    esac
}

# ==========================================
# 1. 環境檢查與檔案準備
# ==========================================
step_check_env() {
    echo ""
    echo -e "${CYAN}[1/4] 檢查環境設定檔...${NC}"
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}   [WARN] 未檢測到 .env，正在從範本建立...${NC}"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${GREEN}   [OK] 已建立 .env 檔案。${NC}"
        else
            echo -e "${RED}   [ERROR] 找不到 .env.example，無法建立配置！${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}   [OK] .env 檔案已存在。${NC}"
    fi
}

# ==========================================
# 2. 配置精靈
# ==========================================
config_wizard() {
    clear
    echo -e "${CYAN}=======================================================${NC}"
    echo -e "${CYAN} 🧙 環境變數配置精靈 (.env)${NC}"
    echo -e "${CYAN}=======================================================${NC}"
    echo ""

    # --- Gemini ---
    echo -e "${YELLOW}[1/2] Google Gemini API Keys (必填)${NC}"
    echo -e " 格式：Key1,Key2 (逗號分隔)"
    while true; do
        read -p " Gemini Keys: " input_gemini
        if [ -n "$input_gemini" ]; then
            update_env "GEMINI_API_KEY" "$input_gemini"
            break
        else
            echo -e "${RED}   ❌ 此欄位為必填！${NC}"
        fi
    done

    # --- Telegram ---
    echo ""
    echo -e "${YELLOW}[2/2] Telegram Bot 設定 (必填)${NC}"
    while true; do
        read -p " Telegram Bot Token: " input_tg
        if [ -n "$input_tg" ]; then
            update_env "TELEGRAM_BOT_TOKEN" "$input_tg"
            break
        else
            echo -e "${RED}   ❌ 此欄位為必填！${NC}"
        fi
    done

    while true; do
        read -p " Admin User ID: " input_tg_id
        if [ -n "$input_tg_id" ]; then
            update_env "TELEGRAM_USER_ID" "$input_tg_id"
            break
        else
            echo -e "${RED}   ❌ 此欄位為必填！${NC}"
        fi
    done

    # --- Discord ---
    echo ""
    echo -e "${CYAN}[Optional] Discord Bot 設定${NC}"
    read -p " Discord Token (按Enter跳過): " input_dc
    if [ -n "$input_dc" ]; then
        update_env "DISCORD_TOKEN" "$input_dc"
    fi

    echo ""
    echo -e "${GREEN}[OK] 配置完成！${NC}"
    sleep 1
}

# ==========================================
# 3. 依賴安裝
# ==========================================
step_install_core() {
    echo ""
    echo -e "${CYAN}[3/4] 安裝核心依賴...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] npm install 失敗。${NC}"
        exit 1
    fi

    echo ""
    echo -e "${CYAN}[4/4] 安裝儀表板...${NC}"
    if [ -d "web-dashboard" ]; then
        cd web-dashboard
        npm install
        cd ..
    else
        echo -e "${YELLOW}[WARN] 無 Dashboard 資料夾，跳過。${NC}"
    fi
}

# ==========================================
# 4. 安裝完成與倒數啟動
# ==========================================
step_final() {
    clear
    echo -e "${GREEN}=======================================================${NC}"
    echo -e "${GREEN} 🎉 部署成功！所有系統已就緒。${NC}"
    echo -e "${GREEN}=======================================================${NC}"
    echo ""
    echo -e " 系統將在 10 秒後自動啟動..."
    echo -e " (按 Ctrl+C 可取消)"
    echo ""
    
    # 倒數計時邏輯
    secs=10
    while [ $secs -gt 0 ]; do
       echo -ne " \r⏳ 倒數: $secs 秒... "
       sleep 1
       : $((secs--))
    done
    echo ""
    launch_system
}

# ==========================================
# 啟動系統核心邏輯 (Process Manager)
# ==========================================
launch_system() {
    clear
    echo -e "${CYAN}=======================================================${NC}"
    echo -e "${CYAN} 🚀 正在啟動 Golem System...${NC}"
    echo -e "${CYAN}=======================================================${NC}"
    echo ""

    # 1. 啟動 Dashboard (背景執行)
    if [ -d "web-dashboard/node_modules" ]; then
        echo -e "${GREEN}[1/2] 啟動 Dashboard (Background)...${NC}"
        echo -e "      👉 http://localhost:3000"
        
        # 進入目錄，背景執行，並將日誌導向 /dev/null 或檔案
        (cd web-dashboard && npm run dev > /dev/null 2>&1) &
        DASHBOARD_PID=$!
        echo -e "      (PID: $DASHBOARD_PID)"
    else
        echo -e "${YELLOW}[SKIP] 未檢測到 Dashboard 安裝，僅啟動核心。${NC}"
        DASHBOARD_PID=""
    fi

    # 2. 啟動 Core (前台執行)
    echo ""
    echo -e "${GREEN}[2/2] 啟動 AI Core (Foreground)...${NC}"
    echo -e "      (按 Ctrl+C 停止所有服務)"
    echo ""

    # 設定 Trap：當使用者按 Ctrl+C 停止 Core 時，同時殺死 Dashboard
    trap "echo ''; echo -e '${YELLOW}正在關閉 Dashboard...${NC}'; kill $DASHBOARD_PID 2>/dev/null; exit" SIGINT SIGTERM

    # 啟動核心
    node index.js
}

# --- 程式入口 ---
show_menu
