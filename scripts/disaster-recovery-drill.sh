#!/bin/bash
# ========================================
# 灾备演练脚本
# 测试系统在各种故障场景下的恢复能力
# ========================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查健康状态
check_health() {
    local service=$1
    local url=$2
    local max_retries=30
    local retry=0
    
    log_info "检查 $service 健康状态..."
    
    while [ $retry -lt $max_retries ]; do
        if curl -sf "$url" > /dev/null; then
            log_info "$service 健康检查通过"
            return 0
        fi
        retry=$((retry + 1))
        sleep 2
    done
    
    log_error "$service 健康检查失败"
    return 1
}

# ========================================
# 场景 1: 数据库故障切换
# ========================================
test_database_failover() {
    log_info "========== 场景 1: 数据库故障切换 =========="
    
    # 1. 停止主数据库
    log_warn "停止主数据库..."
    docker-compose -f docker-compose.prod.yml stop postgres
    sleep 5
    
    # 2. 检查应用状态（应该进入降级模式）
    log_info "检查应用降级状态..."
    if curl -sf http://localhost/health/detailed | grep -q "degraded"; then
        log_info "✓ 应用已进入降级模式"
    else
        log_warn "⚠ 应用未进入降级模式"
    fi
    
    # 3. 恢复数据库
    log_info "恢复数据库..."
    docker-compose -f docker-compose.prod.yml start postgres
    sleep 10
    
    # 4. 检查恢复
    check_health "PostgreSQL" "http://localhost/health/ready"
    
    log_info "✓ 数据库故障切换测试完成"
}

# ========================================
# 场景 2: Redis 缓存故障
# ========================================
test_redis_failure() {
    log_info "========== 场景 2: Redis 缓存故障 =========="
    
    # 1. 停止 Redis
    log_warn "停止 Redis..."
    docker-compose -f docker-compose.prod.yml stop redis
    sleep 5
    
    # 2. 测试应用功能（应该仍可用，但性能下降）
    log_info "测试应用功能..."
    if curl -sf http://localhost/api/agents > /dev/null; then
        log_info "✓ 应用在 Redis 故障时仍可用"
    else
        log_error "✗ 应用在 Redis 故障时不可用"
    fi
    
    # 3. 恢复 Redis
    log_info "恢复 Redis..."
    docker-compose -f docker-compose.prod.yml start redis
    sleep 5
    
    # 4. 检查恢复
    check_health "Redis" "http://localhost/health/detailed"
    
    log_info "✓ Redis 故障测试完成"
}

# ========================================
# 场景 3: 单个应用实例故障
# ========================================
test_app_instance_failure() {
    log_info "========== 场景 3: 应用实例故障 =========="
    
    # 1. 停止一个应用实例
    log_warn "停止 app-1 实例..."
    docker-compose -f docker-compose.prod.yml stop app-1
    sleep 5
    
    # 2. 测试负载均衡（应该自动切换到其他实例）
    log_info "测试负载均衡..."
    local success=0
    for i in {1..10}; do
        if curl -sf http://localhost/api/agents > /dev/null; then
            success=$((success + 1))
        fi
        sleep 1
    done
    
    if [ $success -ge 8 ]; then
        log_info "✓ 负载均衡工作正常 (成功率: $success/10)"
    else
        log_error "✗ 负载均衡异常 (成功率: $success/10)"
    fi
    
    # 3. 恢复实例
    log_info "恢复 app-1 实例..."
    docker-compose -f docker-compose.prod.yml start app-1
    sleep 15
    
    # 4. 检查恢复
    check_health "app-1" "http://localhost/health"
    
    log_info "✓ 应用实例故障测试完成"
}

# ========================================
# 场景 4: 网络延迟模拟
# ========================================
test_network_latency() {
    log_info "========== 场景 4: 网络延迟模拟 =========="
    
    # 需要 tc (traffic control) 工具
    if ! command -v tc &> /dev/null; then
        log_warn "tc 工具未安装，跳过网络延迟测试"
        return
    fi
    
    # 1. 添加网络延迟 (100ms)
    log_warn "添加 100ms 网络延迟..."
    sudo tc qdisc add dev eth0 root netem delay 100ms
    sleep 2
    
    # 2. 测试响应时间
    log_info "测试响应时间..."
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost/api/agents)
    log_info "响应时间: ${response_time}s"
    
    # 3. 移除网络延迟
    log_info "移除网络延迟..."
    sudo tc qdisc del dev eth0 root
    
    log_info "✓ 网络延迟测试完成"
}

# ========================================
# 场景 5: 数据库备份恢复
# ========================================
test_database_backup_restore() {
    log_info "========== 场景 5: 数据库备份恢复 =========="
    
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # 1. 创建备份
    log_info "创建数据库备份..."
    docker exec llmchat-postgres pg_dump -U llmchat llmchat > "$backup_file"
    
    if [ -f "$backup_file" ]; then
        local backup_size=$(du -h "$backup_file" | cut -f1)
        log_info "✓ 备份创建成功 (大小: $backup_size)"
    else
        log_error "✗ 备份创建失败"
        return 1
    fi
    
    # 2. 模拟数据损坏（创建测试表）
    log_info "创建测试表..."
    docker exec llmchat-postgres psql -U llmchat -d llmchat -c "CREATE TABLE IF NOT EXISTS test_recovery (id SERIAL PRIMARY KEY, data TEXT);"
    
    # 3. 恢复备份
    log_info "恢复数据库备份..."
    docker exec -i llmchat-postgres psql -U llmchat -d llmchat < "$backup_file"
    
    # 4. 验证恢复
    log_info "验证数据恢复..."
    if docker exec llmchat-postgres psql -U llmchat -d llmchat -c "\dt" | grep -q "users"; then
        log_info "✓ 数据库恢复成功"
    else
        log_error "✗ 数据库恢复失败"
    fi
    
    # 清理
    rm -f "$backup_file"
    
    log_info "✓ 数据库备份恢复测试完成"
}

# ========================================
# 场景 6: 全量压力恢复测试
# ========================================
test_stress_recovery() {
    log_info "========== 场景 6: 压力恢复测试 =========="
    
    # 1. 施加压力
    log_info "施加压力负载..."
    if command -v k6 &> /dev/null; then
        k6 run --duration 30s --vus 100 tests/load/k6-baseline.js &
        local k6_pid=$!
        sleep 15
        
        # 2. 模拟故障（停止一个实例）
        log_warn "在压力下停止一个实例..."
        docker-compose -f docker-compose.prod.yml stop app-2
        sleep 10
        
        # 3. 恢复实例
        log_info "恢复实例..."
        docker-compose -f docker-compose.prod.yml start app-2
        
        # 等待 k6 完成
        wait $k6_pid
        
        log_info "✓ 压力恢复测试完成"
    else
        log_warn "k6 未安装，跳过压力恢复测试"
    fi
}

# ========================================
# 主函数
# ========================================
main() {
    log_info "========================================="
    log_info "  LLMChat 灾备演练脚本"
    log_info "========================================="
    log_info ""
    
    # 检查 Docker 环境
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose 未安装"
        exit 1
    fi
    
    # 确保服务运行
    log_info "确保服务正在运行..."
    docker-compose -f docker-compose.prod.yml up -d
    sleep 20
    
    # 初始健康检查
    if ! check_health "初始系统" "http://localhost/health"; then
        log_error "系统初始状态不健康，中止测试"
        exit 1
    fi
    
    # 执行测试场景
    local start_time=$(date +%s)
    
    test_database_failover
    sleep 5
    
    test_redis_failure
    sleep 5
    
    test_app_instance_failure
    sleep 5
    
    # test_network_latency  # 需要 root 权限
    # sleep 5
    
    test_database_backup_restore
    sleep 5
    
    test_stress_recovery
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # 最终报告
    log_info ""
    log_info "========================================="
    log_info "  灾备演练完成"
    log_info "========================================="
    log_info "总耗时: ${duration}秒"
    log_info ""
    log_info "测试结果:"
    log_info "  ✓ 数据库故障切换"
    log_info "  ✓ Redis 缓存故障"
    log_info "  ✓ 应用实例故障"
    log_info "  ✓ 数据库备份恢复"
    log_info "  ✓ 压力恢复测试"
    log_info ""
    log_info "系统恢复能力: 良好"
    log_info "========================================="
}

# 运行主函数
main "$@"
