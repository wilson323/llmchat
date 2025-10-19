#!/bin/bash

# LLMChat 健康检查脚本
# 用途: 监控应用健康状态，支持多环境检查

set -euo pipefail

# ========================================
# 🎨 脚本配置
# ========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_header() {
    echo -e "${PURPLE}$1${NC}"
}

# ========================================
# 📋 参数解析
# ========================================
show_help() {
    cat << EOF
LLMChat 健康检查脚本

用法: $0 [选项] [环境]

环境:
  development    开发环境 (默认)
  staging       测试环境
  production    生产环境
  all           检查所有环境

选项:
  -h, --help     显示此帮助信息
  -v, --verbose  详细输出
  -q, --quiet    静默模式 (仅显示错误)
  -f, --format   输出格式: json|text|yaml (默认: text)
  -o, --output   输出文件路径
  -w, --watch    持续监控模式
  -i, --interval 监控间隔 (秒，默认: 30)
  -t, --timeout  请求超时时间 (秒，默认: 10)
  -r, --retries  重试次数 (默认: 3)
  --component   检查特定组件: api|frontend|database|redis|all

示例:
  $0                          # 检查开发环境
  $0 production                # 检查生产环境
  $0 all --format json         # 检查所有环境，JSON格式输出
  $0 production --watch        # 持续监控生产环境
  $0 --component api           # 仅检查API组件

EOF
}

# 默认参数
ENVIRONMENT="development"
VERBOSE=false
QUIET=false
FORMAT="text"
OUTPUT_FILE=""
WATCH=false
INTERVAL=30
TIMEOUT=10
RETRIES=3
COMPONENT="all"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -f|--format)
            FORMAT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -w|--watch)
            WATCH=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            RETRIES="$2"
            shift 2
            ;;
        --component)
            COMPONENT="$2"
            shift 2
            ;;
        -*)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            ENVIRONMENT="$1"
            shift
            ;;
    esac
done

# 验证参数
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production|all)$ ]]; then
    log_error "无效的环境: $ENVIRONMENT"
    show_help
    exit 1
fi

if [[ ! "$FORMAT" =~ ^(json|text|yaml)$ ]]; then
    log_error "无效的输出格式: $FORMAT"
    exit 1
fi

if [[ ! "$COMPONENT" =~ ^(api|frontend|database|redis|all)$ ]]; then
    log_error "无效的组件: $COMPONENT"
    exit 1
fi

# ========================================
# 🌍 环境配置
# ========================================
load_environment_config() {
    case "$ENVIRONMENT" in
        development)
            API_URL="http://localhost:3001"
            FRONTEND_URL="http://localhost:3000"
            DATABASE_HOST="localhost"
            DATABASE_PORT="5432"
            DATABASE_NAME="llmchat"
            REDIS_HOST="localhost"
            REDIS_PORT="6379"
            ;;
        staging)
            API_URL="https://staging.llmchat.example.com"
            FRONTEND_URL="https://staging.llmchat.example.com"
            DATABASE_HOST="staging-db.example.com"
            DATABASE_PORT="5432"
            DATABASE_NAME="llmchat_staging"
            REDIS_HOST="staging-redis.example.com"
            REDIS_PORT="6379"
            ;;
        production)
            API_URL="https://llmchat.example.com"
            FRONTEND_URL="https://llmchat.example.com"
            DATABASE_HOST="prod-db-cluster.example.com"
            DATABASE_PORT="5432"
            DATABASE_NAME="llmchat_production"
            REDIS_HOST="prod-redis-cluster.example.com"
            REDIS_PORT="6379"
            ;;
    esac
}

# ========================================
# 🔍 健康检查函数
# ========================================
check_api_health() {
    local url="${API_URL}/api/health"
    local start_time=$(date +%s%3N)
    local http_code=""
    local response_time=""
    local status="unknown"
    local error_msg=""

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "检查API健康状态: $url"
    fi

    # 执行HTTP请求
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
        --max-time "$TIMEOUT" \
        --retry "$RETRIES" \
        --retry-delay 1 \
        "$url" 2>/dev/null || echo "HTTP_CODE:000")

    # 解析响应
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    response_time=$(echo "$response" | grep "TIME_TOTAL:" | cut -d: -f2)
    response_time=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "0")

    # 判断状态
    if [[ "$http_code" == "200" ]]; then
        status="healthy"
    elif [[ "$http_code" == "000" ]]; then
        status="unreachable"
        error_msg="连接失败"
    else
        status="unhealthy"
        error_msg="HTTP $http_code"
    fi

    # 返回JSON格式的结果
    cat << EOF
{
  "component": "api",
  "url": "$url",
  "status": "$status",
  "http_code": $http_code,
  "response_time_ms": $response_time,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "error_message": "$error_msg"
}
EOF
}

check_frontend_health() {
    local url="$FRONTEND_URL"
    local start_time=$(date +%s%3N)
    local http_code=""
    local response_time=""
    local status="unknown"
    local error_msg=""

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "检查前端健康状态: $url"
    fi

    # 执行HTTP请求
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
        --max-time "$TIMEOUT" \
        --retry "$RETRIES" \
        --retry-delay 1 \
        "$url" 2>/dev/null || echo "HTTP_CODE:000")

    # 解析响应
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    response_time=$(echo "$response" | grep "TIME_TOTAL:" | cut -d: -f2)
    response_time=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "0")

    # 判断状态
    if [[ "$http_code" == "200" ]]; then
        status="healthy"
    elif [[ "$http_code" == "000" ]]; then
        status="unreachable"
        error_msg="连接失败"
    else
        status="unhealthy"
        error_msg="HTTP $http_code"
    fi

    # 返回JSON格式的结果
    cat << EOF
{
  "component": "frontend",
  "url": "$url",
  "status": "$status",
  "http_code": $http_code,
  "response_time_ms": $response_time,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "error_message": "$error_msg"
}
EOF
}

check_database_health() {
    local status="unknown"
    local error_msg=""
    local response_time=0

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "检查数据库健康状态: $DATABASE_HOST:$DATABASE_PORT/$DATABASE_NAME"
    fi

    # 检查PostgreSQL连接
    local start_time=$(date +%s%3N)

    if command -v psql &> /dev/null; then
        if PGPASSWORD="${DATABASE_PASSWORD:-}" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" \
            -U "${DATABASE_USER:-postgres}" -d "$DATABASE_NAME" \
            -c "SELECT 1;" &>/dev/null; then
            status="healthy"
        else
            status="unhealthy"
            error_msg="数据库连接失败"
        fi
    else
        # 使用Docker检查
        if docker exec llmchat-$ENVIRONMENT pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "${DATABASE_USER:-postgres}" &>/dev/null; then
            status="healthy"
        else
            status="unhealthy"
            error_msg="数据库不可达"
        fi
    fi

    local end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))

    # 返回JSON格式的结果
    cat << EOF
{
  "component": "database",
  "host": "$DATABASE_HOST",
  "port": $DATABASE_PORT,
  "database": "$DATABASE_NAME",
  "status": "$status",
  "response_time_ms": $response_time,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "error_message": "$error_msg"
}
EOF
}

check_redis_health() {
    local status="unknown"
    local error_msg=""
    local response_time=0

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "检查Redis健康状态: $REDIS_HOST:$REDIS_PORT"
    fi

    # 检查Redis连接
    local start_time=$(date +%s%3N)

    if command -v redis-cli &> /dev/null; then
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
            status="healthy"
        else
            status="unhealthy"
            error_msg="Redis连接失败"
        fi
    else
        # 使用Docker检查
        if docker exec llmchat-$ENVIRONMENT redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
            status="healthy"
        else
            status="unhealthy"
            error_msg="Redis不可达"
        fi
    fi

    local end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))

    # 返回JSON格式的结果
    cat << EOF
{
  "component": "redis",
  "host": "$REDIS_HOST",
  "port": $REDIS_PORT,
  "status": "$status",
  "response_time_ms": $response_time,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "error_message": "$error_msg"
}
EOF
}

# ========================================
# 📊 格式化输出
# ========================================
format_output() {
    local results="$1"
    local format="$2"

    case "$format" in
        json)
            echo "$results"
            ;;
        yaml)
            if command -v yq &> /dev/null; then
                echo "$results" | yq -P
            else
                log_error "yq未安装，无法输出YAML格式"
                echo "$results"
            fi
            ;;
        text)
            format_text_output "$results"
            ;;
    esac
}

format_text_output() {
    local results="$1"

    if [[ "$QUIET" == "true" ]]; then
        # 静默模式，只显示错误
        local unhealthy_count=$(echo "$results" | jq -r '.[] | select(.status != "healthy") | .component' | wc -l)
        if [[ "$unhealthy_count" -gt 0 ]]; then
            echo "$results" | jq -r '.[] | select(.status != "healthy") | "\(.component): \(.status) - \(.error_message // "无错误信息")"'
        fi
    else
        # 文本格式输出
        echo "========================================"
        echo "健康检查报告"
        echo "环境: $ENVIRONMENT"
        echo "时间: $(date)"
        echo "========================================"
        echo

        echo "$results" | jq -r '.[] |
        "📊 \(.component | ascii_upcase)
   状态: \(.status)
   URL:  \(.url // "\(.host):\(.port)")
   响应时间: \(.response_time_ms)ms
   错误信息: \(.error_message // "无")
   检查时间: \(.timestamp)
"'

        echo
        # 总体状态
        local total_count=$(echo "$results" | jq length)
        local healthy_count=$(echo "$results" | jq -r '.[] | select(.status == "healthy") | .component' | wc -l)
        local unhealthy_count=$((total_count - healthy_count))

        if [[ "$unhealthy_count" -eq 0 ]]; then
            echo -e "${GREEN}✅ 所有组件健康 ($healthy_count/$total_count)${NC}"
        else
            echo -e "${RED}❌ $unhealthy_count/$total_count 个组件不健康${NC}"
        fi
    fi
}

# ========================================
# 🔍 执行健康检查
# ========================================
run_health_checks() {
    local results="["
    local first=true

    # API检查
    if [[ "$COMPONENT" == "all" || "$COMPONENT" == "api" ]]; then
        if [[ "$first" != "true" ]]; then
            results+=","
        fi
        results+=$(check_api_health)
        first=false
    fi

    # 前端检查
    if [[ "$COMPONENT" == "all" || "$COMPONENT" == "frontend" ]]; then
        if [[ "$first" != "true" ]]; then
            results+=","
        fi
        results+=$(check_frontend_health)
        first=false
    fi

    # 数据库检查
    if [[ "$COMPONENT" == "all" || "$COMPONENT" == "database" ]]; then
        if [[ "$first" != "true" ]]; then
            results+=","
        fi
        results+=$(check_database_health)
        first=false
    fi

    # Redis检查
    if [[ "$COMPONENT" == "all" || "$COMPONENT" == "redis" ]]; then
        if [[ "$first" != "true" ]]; then
            results+=","
        fi
        results+=$(check_redis_health)
        first=false
    fi

    results+="]"

    # 格式化并输出结果
    local formatted_output=$(format_output "$results" "$FORMAT")

    # 保存到文件
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo "$formatted_output" > "$OUTPUT_FILE"
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "结果已保存到: $OUTPUT_FILE"
        fi
    else
        echo "$formatted_output"
    fi

    # 检查是否有不健康的组件
    local unhealthy_count=$(echo "$results" | jq -r '.[] | select(.status != "healthy") | .component' | wc -l)
    return $unhealthy_count
}

# ========================================
# 🔄 持续监控模式
# ========================================
run_continuous_monitoring() {
    log_header "🔄 启动持续监控模式"
    log_info "环境: $ENVIRONMENT"
    log_info "间隔: ${INTERVAL}秒"
    log_info "组件: $COMPONENT"
    log_info "按 Ctrl+C 停止监控"
    echo

    local iteration=1

    while true; do
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "执行第 $iteration 次检查..."
        fi

        # 创建时间戳
        local timestamp=$(date +"%Y-%m-%d %H:%M:%S")

        # 执行健康检查
        local exit_code=0
        run_health_checks || exit_code=$?

        # 记录结果到日志文件
        local log_file="$PROJECT_ROOT/logs/health-check-$ENVIRONMENT.log"
        mkdir -p "$(dirname "$log_file")"

        {
            echo "========================================"
            echo "检查时间: $timestamp (第 $iteration 次)"
            echo "环境: $ENVIRONMENT"
            echo "组件: $COMPONENT"
            echo "退出代码: $exit_code"
            echo "========================================"
        } >> "$log_file" 2>&1

        # 如果有不健康的组件，发送通知（这里可以添加通知逻辑）
        if [[ $exit_code -gt 0 ]]; then
            log_warning "发现不健康组件，已记录到日志: $log_file"
            # 这里可以添加Slack、邮件等通知
        fi

        # 等待下一次检查
        if [[ "$WATCH" == "true" ]]; then
            sleep "$INTERVAL"
            ((iteration++))
        else
            break
        fi
    done
}

# ========================================
# 🎯 主函数
# ========================================
main() {
    # 检查依赖
    if ! command -v curl &> /dev/null; then
        log_error "curl 命令未找到，请安装 curl"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq 命令未找到，请安装 jq"
        exit 1
    fi

    # 显示配置信息
    if [[ "$VERBOSE" == "true" ]]; then
        log_header "🔍 LLMChat 健康检查"
        log_info "环境: $ENVIRONMENT"
        log_info "组件: $COMPONENT"
        log_info "格式: $FORMAT"
        log_info "超时: ${TIMEOUT}秒"
        log_info "重试: $RETRIES 次"
        echo
    fi

    # 检查所有环境
    if [[ "$ENVIRONMENT" == "all" ]]; then
        local environments=("development" "staging" "production")
        local total_exit_code=0

        for env in "${environments[@]}"; do
            ENVIRONMENT="$env"
            load_environment_config

            log_header "🔍 检查环境: $env"

            local exit_code=0
            run_health_checks || exit_code=$?

            if [[ $exit_code -gt 0 ]]; then
                total_exit_code=1
            fi

            echo
        done

        exit $total_exit_code
    else
        # 加载环境配置
        load_environment_config

        # 执行检查
        if [[ "$WATCH" == "true" ]]; then
            run_continuous_monitoring
        else
            run_health_checks
        fi
    fi
}

# ========================================
# 🏃‍♂️ 执行脚本
# ========================================
main "$@"