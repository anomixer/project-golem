#!/bin/bash

# ==========================================
# Project Golem v9.0 (Titan Chronos) - Linux/macOS
# ==========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

update_env() {
    local key=$1
    local val=$2
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^$key=.*|$key=$val|" .env
    else
        sed -i "s|^$key=.*|$key=$val|" .env
    fi
}

show_menu() {
    clear
    echo -e "${CYAN}=======================================================${NC}"
    echo -e "${CYAN} 🤖 Project Golem v9.0 (Titan Chronos) Master Control${NC}"
    echo -e "${CYAN}=======================================================${NC}"
    echo ""
    echo " [0] ⚡ 啟動系統 (含 Dashboard)"
    echo " [1] 🚀 完整安裝與部署"
    echo " [Q] 🚪 退出"
    echo ""
    read -p " 請輸入選項: " choice

    case $choice in
        0) launch_system ;;
        1) install_steps ;;
        [Qq]) exit 0 ;;
        *) show_menu ;;
    esac
}

install_steps() {
    # 1. 檢查檔案
    echo -e "\n${GREEN}[1/4] 檢查核心檔案...${NC}"
    for file in index.js skills.js package.json dashboard.js; do
        if [ ! -f "$file" ]; then
            echo -e "${RED}[ERROR] 缺少檔案: $file${NC}"
            exit 1
        fi
    done

    # 2. 環境變數
    echo -e "\n${GREEN}[2/4] 配置 .env...${NC}"
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "已建立 .env"
    fi
    
    # 簡單引導
    read -p "請輸入 Gemini API Key: " gemini_key
    if [ -n "$gemini_key" ]; then update_env "GEMINI_API_KEYS" "$gemini_key"; fi
    
    read -p "請輸入 Telegram Bot Token: " tg_token
    if [ -n "$tg_token" ]; then update_env "TELEGRAM_TOKEN" "$tg_token"; fi

    # 3. 安裝
    echo -e "\n${GREEN}[3/4] 安裝依賴...${NC}"
    npm install
    
    # 4. 啟動
    echo -e "\n${GREEN}[4/4] 準備就緒！${NC}"
    sleep 1
    launch_system
}

launch_system() {
    clear
    echo -e "${CYAN}正在啟動 Dashboard... (按 Ctrl+C 退出)${NC}"
    npm run dashboard
}

show_menu
