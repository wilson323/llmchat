#!/bin/bash

# LLMChat 开发环境启动脚本
# 用途：同时启动前端和后端开发服务器

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印标题
print_header() {
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     LLMChat 开发环境启动脚本                 ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装！请先安装 Node.js 18+"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js 版本建议 18+，当前版本: $(node -v)"
    else
        print_success "Node.js 版本: $(node -v)"
    fi

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装！"
        exit 1
    fi
    print_success "npm 版本: $(npm -v)"

    # 检查 concurrently 是否安装
    if ! npm list concurrently &> /dev/null; then
        print_warning "concurrently 未安装，正在安装..."
        npm install
    fi

    echo ""
}

# 检查环境配置
check_config() {
    print_info "检查配置文件..."

    # 检查后端环境变量
    if [ ! -f "backend/.env" ]; then
        print_warning "backend/.env 不存在"
        if [ -f "backend/.env.example" ]; then
            print_info "正在从 .env.example 创建 .env..."
            cp backend/.env.example backend/.env
            print_success "已创建 backend/.env，请编辑配置后重新运行"
            exit 0
        else
            print_error "backend/.env.example 也不存在！"
            exit 1
        fi
    else
        print_success "backend/.env 配置文件存在"
    fi

    # 检查智能体配置
    if [ ! -f "config/agents.json" ]; then
        print_warning "config/agents.json 不存在"
        if [ -f "config/agents.example.json" ]; then
            print_info "正在从 agents.example.json 创建 agents.json..."
            cp config/agents.example.json config/agents.json
            print_success "已创建 config/agents.json"
        else
            print_warning "config/agents.example.json 也不存在，跳过"
        fi
    else
        print_success "config/agents.json 配置文件存在"
    fi

    echo ""
}

# 检查依赖是否安装
check_node_modules() {
    print_info "检查依赖安装状态..."

    NEED_INSTALL=false

    if [ ! -d "node_modules" ]; then
        print_warning "根目录 node_modules 不存在"
        NEED_INSTALL=true
    fi

    if [ ! -d "backend/node_modules" ]; then
        print_warning "backend/node_modules 不存在"
        NEED_INSTALL=true
    fi

    if [ ! -d "frontend/node_modules" ]; then
        print_warning "frontend/node_modules 不存在"
        NEED_INSTALL=true
    fi

    if [ "$NEED_INSTALL" = true ]; then
        print_info "正在安装依赖..."
        npm install
        print_success "依赖安装完成"
    else
        print_success "所有依赖已安装"
    fi

    echo ""
}

# 清理函数
cleanup() {
    print_info "正在停止服务..."
    # 杀死所有子进程
    pkill -P $$ || true
    print_success "服务已停止"
    exit 0
}

# 捕获 Ctrl+C
trap cleanup SIGINT SIGTERM

# 启动服务
start_services() {
    print_info "启动前后端服务..."
    echo ""
    print_info "后端服务将运行在: ${GREEN}http://localhost:3001${NC}"
    print_info "前端服务将运行在: ${GREEN}http://localhost:3000${NC}"
    echo ""
    print_warning "按 ${RED}Ctrl+C${NC} 停止所有服务"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # 使用 npm run dev 启动
    npm run dev
}

# 主函数
main() {
    print_header
    check_dependencies
    check_config
    check_node_modules
    start_services
}

# 运行主函数
main