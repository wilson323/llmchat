#!/bin/sh
# ==========================================
# LLMChat Full Application Health Check Script
# 完整应用健康检查脚本
# ==========================================

# 设置变量
FRONTEND_URL="http://localhost:80"
BACKEND_URL="http://localhost:3001"
TIMEOUT=10

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

# 检查服务状态
check_service() {
    local service_name=$1
    local service_url=$2
    local health_endpoint=$3

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$service_url$health_endpoint" || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        RESPONSE_BODY=$(curl -s --connect-timeout $TIMEOUT "$service_url$health_endpoint" || echo "")
        if echo "$RESPONSE_BODY" | grep -q "healthy\|ok\|OK"; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️ $service_name responded but health check failed${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ $service_name is unhealthy or unreachable${NC}"
        return 1
    fi
}

# 检查进程
check_processes() {
    log_info "检查应用进程..."

    # 检查Node.js后端进程
    if pgrep -f "node.*backend" > /dev/null; then
        echo "✅ Backend process is running"
        BACKEND_PID=$(pgrep -f "node.*backend")
        echo "   PID: $BACKEND_PID"
    else
        echo "❌ Backend process is not running"
    fi

    # 检查Nginx进程
    if pgrep nginx > /dev/null; then
        echo "✅ Nginx process is running"
        NGINX_PID=$(pgrep nginx)
        echo "   PID: $NGINX_PID"
    else
        echo "❌ Nginx process is not running"
    fi
}

# 检查端口
check_ports() {
    log_info "检查端口占用..."

    # 检查80端口（前端）
    if netstat -ln | grep ":80 " > /dev/null; then
        echo "✅ Port 80 (Frontend) is listening"
    else
        echo "❌ Port 80 (Frontend) is not listening"
    fi

    # 检查3001端口（后端）
    if netstat -ln | grep ":3001 " > /dev/null; then
        echo "✅ Port 3001 (Backend) is listening"
    else
        echo "❌ Port 3001 (Backend) is not listening"
    fi
}

# 检查系统资源
check_system_resources() {
    log_info "检查系统资源..."

    # 磁盘使用率
    DISK_USAGE=$(df /app | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 80 ]; then
        echo "✅ Disk usage: ${DISK_USAGE}%"
    elif [ "$DISK_USAGE" -lt 90 ]; then
        echo "⚠️ Disk usage: ${DISK_USAGE}% (warning)"
    else
        echo "❌ Disk usage: ${DISK_USAGE}% (critical)"
    fi

    # 内存使用率
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    if [ "$(echo "$MEMORY_USAGE < 80" | bc -l)" -eq 1 ]; then
        echo "✅ Memory usage: ${MEMORY_USAGE}%"
    elif [ "$(echo "$MEMORY_USAGE < 90" | bc -l)" -eq 1 ]; then
        echo "⚠️ Memory usage: ${MEMORY_USAGE}% (warning)"
    else
        echo "❌ Memory usage: ${MEMORY_USAGE}% (critical)"
    fi

    # CPU负载
    CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    echo "📊 CPU load: $CPU_LOAD"
}

# 检查应用文件
check_application_files() {
    log_info "检查应用文件..."

    # 检查前端文件
    if [ -f "/app/frontend/static/index.html" ]; then
        echo "✅ Frontend files are present"
    else
        echo "❌ Frontend files are missing"
    fi

    # 检查后端文件
    if [ -f "/app/backend/dist/index.js" ]; then
        echo "✅ Backend files are present"
    else
        echo "❌ Backend files are missing"
    fi

    # 检查配置文件
    if [ -f "/etc/nginx/nginx.conf" ]; then
        echo "✅ Nginx configuration is present"
    else
        echo "❌ Nginx configuration is missing"
    fi
}

# 检查服务间连通性
check_service_connectivity() {
    log_info "检查服务间连通性..."

    # 检查前端到后端的连接
    if curl -s --connect-timeout 5 "$FRONTEND_URL/api/health" >/dev/null; then
        echo "✅ Frontend can connect to backend"
    else
        echo "❌ Frontend cannot connect to backend"
    fi
}

# 生成健康报告
generate_health_report() {
    echo ""
    log_info "生成健康检查报告..."

    REPORT_FILE="/app/health-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$REPORT_FILE" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "frontend": {
        "url": "$FRONTEND_URL",
        "status": "$([ -n "$FRONTEND_STATUS" ] && echo "$FRONTEND_STATUS" || echo "unknown")",
        "http_status": "$([ -n "$FRONTEND_HTTP_STATUS" ] && echo "$FRONTEND_HTTP_STATUS" || echo "0")"
    },
    "backend": {
        "url": "$BACKEND_URL",
        "status": "$([ -n "$BACKEND_STATUS" ] && echo "$BACKEND_STATUS" || echo "unknown")",
        "http_status": "$([ -n "$BACKEND_HTTP_STATUS" ] && echo "$BACKEND_HTTP_STATUS" || echo "0")"
    },
    "system": {
        "disk_usage": "$DISK_USAGE",
        "memory_usage": "$MEMORY_USAGE",
        "cpu_load": "$CPU_LOAD"
    },
    "overall_status": "$OVERALL_STATUS"
}
EOF

    echo "📄 健康报告已保存到: $REPORT_FILE"
}

# 主健康检查函数
main_health_check() {
    echo "🏥 LLMChat 完整应用健康检查"
    echo "========================================"
    echo "时间: $(date)"
    echo ""

    # 检查各个服务
    echo "🔍 服务健康状态:"
    if check_service "Frontend" "$FRONTEND_URL" "/health"; then
        FRONTEND_STATUS="healthy"
        FRONTEND_HTTP_STATUS="200"
    else
        FRONTEND_STATUS="unhealthy"
        FRONTEND_HTTP_STATUS="$HTTP_STATUS"
    fi

    if check_service "Backend" "$BACKEND_URL" "/api/health"; then
        BACKEND_STATUS="healthy"
        BACKEND_HTTP_STATUS="200"
    else
        BACKEND_STATUS="unhealthy"
        BACKEND_HTTP_STATUS="$HTTP_STATUS"
    fi

    echo ""

    # 详细检查
    check_processes
    echo ""
    check_ports
    echo ""
    check_system_resources
    echo ""
    check_application_files
    echo ""
    check_service_connectivity

    # 确定整体状态
    if [ "$FRONTEND_STATUS" = "healthy" ] && [ "$BACKEND_STATUS" = "healthy" ]; then
        OVERALL_STATUS="healthy"
        echo ""
        log_success "🎉 整体应用状态: 健康"
        return 0
    else
        OVERALL_STATUS="unhealthy"
        echo ""
        log_error "❌ 整体应用状态: 不健康"
        return 1
    fi
}

# 执行健康检查
if [ "$1" = "--detailed" ]; then
    main_health_check
    generate_health_report
elif [ "$1" = "--report-only" ]; then
    generate_health_report
else
    main_health_check
fi