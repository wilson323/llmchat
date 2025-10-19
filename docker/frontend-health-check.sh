#!/bin/sh
# ==========================================
# LLMChat Frontend Health Check Script
# 前端服务健康检查脚本
# ==========================================

# 设置变量
FRONTEND_URL="http://localhost:80"
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
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$FRONTEND_URL$HEALTH_ENDPOINT" || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        # 获取响应体
        RESPONSE_BODY=$(curl -s --connect-timeout $TIMEOUT "$FRONTEND_URL$HEALTH_ENDPOINT" || echo "")

        # 检查响应内容
        if echo "$RESPONSE_BODY" | grep -q "healthy\|ok\|OK"; then
            echo -e "${GREEN}✅ Frontend is healthy${NC}"
            echo "Status: $HTTP_STATUS"
            echo "Response: $RESPONSE_BODY"
            return 0
        else
            echo -e "${YELLOW}⚠️ Frontend responded but health check failed${NC}"
            echo "Status: $HTTP_STATUS"
            echo "Response: $RESPONSE_BODY"
            return 1
        fi
    else
        echo -e "${RED}❌ Frontend is unhealthy or unreachable${NC}"
        echo "Status: $HTTP_STATUS"
        return 1
    fi
}

# 详细健康检查
detailed_health_check() {
    echo "📊 Detailed Frontend Health Check"
    echo "================================="

    # 基本健康检查
    if health_check; then
        echo ""
        echo "🔍 Additional Checks:"

        # 检查Nginx进程
        if pgrep nginx > /dev/null; then
            echo "✅ Nginx process is running"
        else
            echo "❌ Nginx process is not running"
        fi

        # 检查端口
        if netstat -ln | grep ":80 " > /dev/null; then
            echo "✅ Port 80 is listening"
        else
            echo "❌ Port 80 is not listening"
        fi

        # 检查静态文件
        if [ -f "/usr/share/nginx/html/index.html" ]; then
            echo "✅ Static files are present"
        else
            echo "❌ Static files are missing"
        fi

        # 检查Nginx配置
        if nginx -t >/dev/null 2>&1; then
            echo "✅ Nginx configuration is valid"
        else
            echo "❌ Nginx configuration has errors"
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