#!/bin/sh
# ==========================================
# LLMChat Full Application Startup Script
# 前后端一体化应用启动脚本
# ==========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境变量
check_env() {
    log_info "检查环境变量..."

    # 必需的环境变量
    REQUIRED_VARS="NODE_ENV PORT"

    for var in $REQUIRED_VARS; do
        if [ -z "$(eval echo \$$var)" ]; then
            log_warning "环境变量 $var 未设置，使用默认值"
            case $var in
                NODE_ENV)
                    export NODE_ENV="production"
                    ;;
                PORT)
                    export PORT="3001"
                    ;;
            esac
        fi
    done

    log_success "环境变量检查完成"
}

# 检查文件和目录
check_files() {
    log_info "检查应用文件和目录..."

    # 检查必要文件
    REQUIRED_FILES="backend/dist/index.js"

    for file in $REQUIRED_FILES; do
        if [ ! -f "$file" ]; then
            log_error "必要文件不存在: $file"
            exit 1
        fi
    done

    # 检查必要目录
    REQUIRED_DIRS="logs uploads tmp"

    for dir in $REQUIRED_DIRS; do
        if [ ! -d "$dir" ]; then
            log_warning "目录不存在，创建: $dir"
            mkdir -p "$dir"
        fi
    done

    log_success "文件和目录检查完成"
}

# 启动后端服务
start_backend() {
    log_info "启动后端服务..."

    # 设置后端环境变量
    export NODE_ENV=${NODE_ENV:-"production"}
    export PORT=${PORT:-"3001"}

    # 启动后端
    cd /app
    node backend/dist/index.js &
    BACKEND_PID=$!

    # 等待后端启动
    log_info "等待后端服务启动..."
    sleep 5

    # 检查后端是否启动成功
    if kill -0 $BACKEND_PID 2>/dev/null; then
        log_success "后端服务启动成功 (PID: $BACKEND_PID)"
        echo $BACKEND_PID > /tmp/backend.pid
    else
        log_error "后端服务启动失败"
        exit 1
    fi
}

# 启动前端服务
start_frontend() {
    log_info "启动前端服务..."

    # 启动nginx
    nginx -g "daemon off;" &
    NGINX_PID=$!

    # 等待nginx启动
    sleep 2

    # 检查nginx是否启动成功
    if kill -0 $NGINX_PID 2>/dev/null; then
        log_success "前端服务启动成功 (PID: $NGINX_PID)"
        echo $NGINX_PID > /tmp/nginx.pid
    else
        log_error "前端服务启动失败"
        exit 1
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."

    # 检查前端健康状态
    FRONTEND_HEALTH=0
    for i in 1 2 3 4 5; do
        if curl -f http://localhost:80/health >/dev/null 2>&1; then
            FRONTEND_HEALTH=1
            break
        fi
        log_warning "前端健康检查失败，重试 $i/5"
        sleep 2
    done

    # 检查后端健康状态
    BACKEND_HEALTH=0
    for i in 1 2 3 4 5; do
        if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
            BACKEND_HEALTH=1
            break
        fi
        log_warning "后端健康检查失败，重试 $i/5"
        sleep 2
    done

    if [ $FRONTEND_HEALTH -eq 1 ] && [ $BACKEND_HEALTH -eq 1 ]; then
        log_success "所有服务健康检查通过"
        return 0
    else
        log_error "健康检查失败"
        [ $FRONTEND_HEALTH -eq 0 ] && log_error "前端服务不健康"
        [ $BACKEND_HEALTH -eq 0 ] && log_error "后端服务不健康"
        return 1
    fi
}

# 信号处理
cleanup() {
    log_info "收到停止信号，开始优雅关闭..."

    # 停止后端
    if [ -f /tmp/backend.pid ]; then
        BACKEND_PID=$(cat /tmp/backend.pid)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            log_info "停止后端服务 (PID: $BACKEND_PID)"
            kill -TERM $BACKEND_PID
            wait $BACKEND_PID
        fi
        rm -f /tmp/backend.pid
    fi

    # 停止前端
    if [ -f /tmp/nginx.pid ]; then
        NGINX_PID=$(cat /tmp/nginx.pid)
        if kill -0 $NGINX_PID 2>/dev/null; then
            log_info "停止前端服务 (PID: $NGINX_PID)"
            kill -TERM $NGINX_PID
            wait $NGINX_PID
        fi
        rm -f /tmp/nginx.pid
    fi

    log_success "所有服务已停止"
    exit 0
}

# 设置信号处理
trap cleanup SIGTERM SIGINT SIGQUIT

# 主函数
main() {
    log_info "启动 LLMChat 完整应用..."
    log_info "环境: $NODE_ENV"
    log_info "后端端口: $PORT"
    log_info "前端端口: 80"

    # 执行检查
    check_env
    check_files

    # 启动服务
    start_backend
    start_frontend

    # 健康检查
    if health_check; then
        log_success "🎉 LLMChat 应用启动成功！"
        log_info "前端访问地址: http://localhost:80"
        log_info "后端API地址: http://localhost:3001"
        log_info "健康检查地址: http://localhost:80/health"

        # 保持运行
        wait
    else
        log_error "应用启动失败，开始清理..."
        cleanup
        exit 1
    fi
}

# 执行主函数
main "$@"