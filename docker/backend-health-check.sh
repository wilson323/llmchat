#!/bin/sh
# ==========================================
# LLMChat Backend Health Check Script
# 后端服务健康检查脚本
# ==========================================

# 设置变量
BACKEND_URL="http://localhost:3001"
HEALTH_ENDPOINT="/health"
TIMEOUT=10

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 健康检查函数
health_check() {
    # 检查HTTP响应
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$BACKEND_URL$HEALTH_ENDPOINT" || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        # 获取响应体
        RESPONSE_BODY=$(curl -s --connect-timeout $TIMEOUT "$BACKEND_URL$HEALTH_ENDPOINT" || echo "")

        # 检查响应内容
        if echo "$RESPONSE_BODY" | grep -q "healthy\|ok\|OK"; then
            echo -e "${GREEN}✅ Backend is healthy${NC}"
            echo "Status: $HTTP_STATUS"
            echo "Response: $RESPONSE_BODY"
            return 0
        else
            echo -e "${YELLOW}⚠️ Backend responded but health check failed${NC}"
            echo "Status: $HTTP_STATUS"
            echo "Response: $RESPONSE_BODY"
            return 1
        fi
    else
        echo -e "${RED}❌ Backend is unhealthy or unreachable${NC}"
        echo "Status: $HTTP_STATUS"
        return 1
    fi
}

# 详细健康检查
detailed_health_check() {
    echo "📊 Detailed Backend Health Check"
    echo "================================"

    # 基本健康检查
    if health_check; then
        echo ""
        echo "🔍 Additional Checks:"

        # 检查进程
        if pgrep -f "node.*backend" > /dev/null; then
            echo "✅ Backend process is running"
        else
            echo "❌ Backend process is not running"
        fi

        # 检查端口
        if netstat -ln | grep ":3001 " > /dev/null; then
            echo "✅ Port 3001 is listening"
        else
            echo "❌ Port 3001 is not listening"
        fi

        # 检查磁盘空间
        DISK_USAGE=$(df /app | tail -1 | awk '{print $5}' | sed 's/%//')
        if [ "$DISK_USAGE" -lt 90 ]; then
            echo "✅ Disk usage: ${DISK_USAGE}%"
        else
            echo "⚠️ Disk usage: ${DISK_USAGE}% (high)"
        fi

        # 检查内存
        MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
        if [ "$(echo "$MEMORY_USAGE < 90" | bc -l)" -eq 1 ]; then
            echo "✅ Memory usage: ${MEMORY_USAGE}%"
        else
            echo "⚠️ Memory usage: ${MEMORY_USAGE}% (high)"
        fi

        return 0
    else
        return 1
    fi
}

# 执行健康检查
if [ "$1" = "--detailed" ]; then
    detailed_health_check
else
    health_check
fi