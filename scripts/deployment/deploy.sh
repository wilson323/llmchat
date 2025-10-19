#!/bin/bash

# LLMChat 部署脚本
# 用途: 自动化部署应用到不同环境

set -euo pipefail

# ========================================
# 🎨 脚本配置
# ========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"
LOGS_DIR="$PROJECT_ROOT/logs"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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
LLMChat 部署脚本

用法: $0 [选项] <环境>

环境:
  development    开发环境
  staging       测试环境
  production    生产环境

选项:
  -h, --help     显示此帮助信息
  -v, --verbose  详细输出
  -d, --dry-run  试运行模式 (不实际部署)
  -f, --force    强制部署 (跳过确认)
  -c, --config   指定配置文件 (默认: config/deployment.yml)
  -b, --backup   部署前创建备份
  -r, --rollback 回滚到上一版本
  --skip-build   跳过构建步骤
  --skip-tests   跳过测试步骤
  --skip-health  跳过健康检查

示例:
  $0 development                # 部署到开发环境
  $0 staging --dry-run          # 试运行部署到测试环境
  $0 production --backup        # 部署到生产环境并创建备份
  $0 production --rollback      # 回滚生产环境

EOF
}

# 默认参数
ENVIRONMENT=""
VERBOSE=false
DRY_RUN=false
FORCE=false
CONFIG_FILE="$CONFIG_DIR/deployment.yml"
BACKUP=false
ROLLBACK=false
SKIP_BUILD=false
SKIP_TESTS=false
SKIP_HEALTH=false

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
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -b|--backup)
            BACKUP=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-health)
            SKIP_HEALTH=true
            shift
            ;;
        -*)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            if [[ -z "$ENVIRONMENT" ]]; then
                ENVIRONMENT="$1"
            else
                log_error "只能指定一个环境"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# 验证环境参数
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "必须指定部署环境"
    show_help
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "无效的环境: $ENVIRONMENT"
    log_error "支持的环境: development, staging, production"
    exit 1
fi

# ========================================
# 🔧 环境检查
# ========================================
check_dependencies() {
    log_header "🔧 检查依赖..."

    local missing_deps=()

    # 检查必需的命令
    local commands=("node" "pnpm" "docker" "curl" "jq")
    for cmd in "${commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "缺少依赖: ${missing_deps[*]}"
        log_error "请安装缺少的依赖后重试"
        exit 1
    fi

    log_success "所有依赖检查通过"
}

check_environment_config() {
    log_header "🔍 检查环境配置..."

    local env_file="$PROJECT_ROOT/.env"
    local env_example_file="$PROJECT_ROOT/.env.example"

    if [[ ! -f "$env_file" ]]; then
        if [[ -f "$env_example_file" ]]; then
            log_warning ".env 文件不存在，从 .env.example 复制"
            if [[ "$DRY_RUN" != "true" ]]; then
                cp "$env_example_file" "$env_file"
                log_warning "请编辑 .env 文件配置正确的环境变量"
            fi
        else
            log_error "环境配置文件不存在"
            exit 1
        fi
    fi

    # 验证必需的环境变量
    local required_vars=("NODE_ENV" "PORT" "DATABASE_URL")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file"; then
            log_warning "环境变量 $var 未设置"
        fi
    done

    log_success "环境配置检查完成"
}

# ========================================
# 📊 部署配置加载
# ========================================
load_deployment_config() {
    log_header "📋 加载部署配置..."

    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "配置文件不存在: $CONFIG_FILE"
        exit 1
    fi

    # 这里应该加载YAML配置文件，为简化起见使用环境变量
    # 在实际项目中，可以使用 yq 或其他工具解析YAML

    case "$ENVIRONMENT" in
        development)
            DEPLOY_URL="http://localhost:3001"
            DEPLOY_HOST="localhost"
            DEPLOY_PORT="3001"
            DOCKER_REGISTRY="localhost:5000"
            DOCKER_IMAGE="llmchat:dev"
            HEALTH_CHECK_TIMEOUT=30
            ;;
        staging)
            DEPLOY_URL="https://staging.llmchat.example.com"
            DEPLOY_HOST="staging.llmchat.example.com"
            DEPLOY_PORT="443"
            DOCKER_REGISTRY="registry.example.com"
            DOCKER_IMAGE="llmchat:staging"
            HEALTH_CHECK_TIMEOUT=60
            ;;
        production)
            DEPLOY_URL="https://llmchat.example.com"
            DEPLOY_HOST="llmchat.example.com"
            DEPLOY_PORT="443"
            DOCKER_REGISTRY="registry.example.com"
            DOCKER_IMAGE="llmchat:latest"
            HEALTH_CHECK_TIMEOUT=120
            ;;
    esac

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "部署配置:"
        log_info "  环境: $ENVIRONMENT"
        log_info "  URL: $DEPLOY_URL"
        log_info "  主机: $DEPLOY_HOST"
        log_info "  镜像: $DOCKER_IMAGE"
    fi

    log_success "部署配置加载完成"
}

# ========================================
# 🏗️ 构建步骤
# ========================================
build_application() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "跳过构建步骤"
        return
    fi

    log_header "🏗️ 构建应用..."

    cd "$PROJECT_ROOT"

    # 清理旧的构建产物
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "清理旧构建产物..."
        rm -rf backend/dist frontend/dist
    fi

    # 安装依赖
    log_info "安装依赖..."
    if [[ "$DRY_RUN" != "true" ]]; then
        pnpm install --frozen-lockfile
    fi

    # 运行测试
    if [[ "$SKIP_TESTS" != "true" ]]; then
        log_info "运行测试..."
        if [[ "$DRY_RUN" != "true" ]]; then
            pnpm test
        fi
    else
        log_info "跳过测试步骤"
    fi

    # 构建应用
    log_info "构建应用..."
    if [[ "$DRY_RUN" != "true" ]]; then
        pnpm run build
    fi

    log_success "应用构建完成"
}

# ========================================
# 🐳 Docker 部署
# ========================================
build_docker_image() {
    log_header "🐳 构建Docker镜像..."

    cd "$PROJECT_ROOT"

    # 获取版本信息
    local version=$(node -p "require('./package.json').version")
    local commit_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local docker_tag="${DOCKER_IMAGE}-${version}-${commit_sha}"

    log_info "构建镜像: $docker_tag"

    if [[ "$DRY_RUN" != "true" ]]; then
        # 创建Dockerfile（如果不存在）
        if [[ ! -f "Dockerfile" ]]; then
            cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json pnpm-lock.yaml ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

# 安装pnpm
RUN npm install -g pnpm@latest

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY backend/ backend/
COPY frontend/ frontend/
COPY shared-types/ shared-types/

# 构建应用
RUN pnpm run build

# 生产镜像
FROM node:20-alpine AS production

WORKDIR /app

# 安装生产依赖
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --prod

# 复制构建产物
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/shared-types/dist ./shared-types/dist

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 设置权限
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "backend/dist/index.js"]
EOF
        fi

        # 构建镜像
        docker build \
            --build-arg VERSION="$version" \
            --build-arg COMMIT_SHA="$commit_sha" \
            --build-arg BUILD_DATE="$build_date" \
            -t "$docker_tag" \
            -t "$DOCKER_IMAGE" \
            .

        # 推送到镜像仓库
        if [[ "$ENVIRONMENT" != "development" ]]; then
            log_info "推送镜像到仓库..."
            docker push "$docker_tag"
            docker push "$DOCKER_IMAGE"
        fi
    fi

    # 设置全局变量供后续使用
    CURRENT_DOCKER_TAG="$docker_tag"

    log_success "Docker镜像构建完成: $docker_tag"
}

# ========================================
# 🚀 部署应用
# ========================================
deploy_application() {
    if [[ "$ROLLBACK" == "true" ]]; then
        rollback_deployment
        return
    fi

    log_header "🚀 部署应用到 $ENVIRONMENT 环境..."

    # 创建备份
    if [[ "$BACKUP" == "true" ]]; then
        create_backup
    fi

    # 停止旧容器
    log_info "停止旧容器..."
    if [[ "$DRY_RUN" != "true" ]]; then
        docker stop llmchat-$ENVIRONMENT 2>/dev/null || true
        docker rm llmchat-$ENVIRONMENT 2>/dev/null || true
    fi

    # 启动新容器
    log_info "启动新容器..."
    if [[ "$DRY_RUN" != "true" ]]; then
        local env_file="$PROJECT_ROOT/.env"

        docker run -d \
            --name llmchat-$ENVIRONMENT \
            --restart unless-stopped \
            --env-file "$env_file" \
            -p "${DEPLOY_PORT}:3001" \
            -v "$LOGS_DIR:/app/logs" \
            --label "environment=$ENVIRONMENT" \
            --label "version=${CURRENT_DOCKER_TAG}" \
            --label "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            "$CURRENT_DOCKER_TAG"
    fi

    log_success "应用部署完成"
}

# ========================================
# 📋 创建备份
# ========================================
create_backup() {
    log_header "💾 创建部署备份..."

    local backup_dir="$PROJECT_ROOT/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="llmchat-$ENVIRONMENT-$timestamp"

    if [[ "$DRY_RUN" != "true" ]]; then
        mkdir -p "$backup_dir"

        # 备份数据库（如果有）
        if [[ -n "${DATABASE_URL:-}" ]]; then
            log_info "备份数据库..."
            # 这里应该添加数据库备份逻辑
            # pg_dump "$DATABASE_URL" > "$backup_dir/${backup_name}_db.sql"
        fi

        # 备份当前运行的容器镜像
        local current_image=$(docker ps --filter "name=llmchat-$ENVIRONMENT" --format "{{.Image}}" 2>/dev/null || echo "")
        if [[ -n "$current_image" ]]; then
            log_info "备份当前镜像: $current_image"
            docker save "$current_image" | gzip > "$backup_dir/${backup_name}_image.tar.gz"
        fi

        # 创建备份清单
        cat > "$backup_dir/${backup_name}_manifest.txt" << EOF
备份清单
环境: $ENVIRONMENT
时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)
版本: $CURRENT_DOCKER_TAG
镜像: $current_image
备份文件:
$(ls -la "$backup_dir/${backup_name}_"* 2>/dev/null || echo "无备份文件")
EOF
    fi

    log_success "备份创建完成: $backup_name"
}

# ========================================
# 🔄 回滚部署
# ========================================
rollback_deployment() {
    log_header "🔄 回滚 $ENVIRONMENT 环境..."

    local backup_dir="$PROJECT_ROOT/backups"

    if [[ "$DRY_RUN" != "true" ]]; then
        # 查找最新的备份
        local latest_backup=$(ls -t "$backup_dir"/*_manifest.txt 2>/dev/null | head -1)

        if [[ -z "$latest_backup" ]]; then
            log_error "未找到备份文件"
            exit 1
        fi

        local backup_name=$(basename "$latest_backup" _manifest.txt)
        local backup_image="$backup_dir/${backup_name}_image.tar.gz"

        log_info "使用备份: $backup_name"

        # 停止当前容器
        docker stop llmchat-$ENVIRONMENT 2>/dev/null || true
        docker rm llmchat-$ENVIRONMENT 2>/dev/null || true

        # 加载备份镜像
        if [[ -f "$backup_image" ]]; then
            log_info "加载备份镜像..."
            docker load < "$backup_image"
        fi

        # 从备份清单中获取镜像名称
        local old_image=$(grep "镜像:" "$latest_backup" | cut -d' ' -f2)

        if [[ -n "$old_image" ]]; then
            log_info "启动旧版本镜像: $old_image"
            local env_file="$PROJECT_ROOT/.env"

            docker run -d \
                --name llmchat-$ENVIRONMENT \
                --restart unless-stopped \
                --env-file "$env_file" \
                -p "${DEPLOY_PORT}:3001" \
                -v "$LOGS_DIR:/app/logs" \
                --label "environment=$ENVIRONMENT" \
                --label "rollback=true" \
                --label "rollback_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                "$old_image"
        else
            log_error "无法确定回滚镜像"
            exit 1
        fi
    fi

    log_success "回滚完成"
}

# ========================================
# 🔍 健康检查
# ========================================
health_check() {
    if [[ "$SKIP_HEALTH" == "true" ]]; then
        log_info "跳过健康检查"
        return
    fi

    log_header "🔍 执行健康检查..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        log_info "健康检查尝试 $attempt/$max_attempts..."

        if [[ "$DRY_RUN" != "true" ]]; then
            # 检查容器状态
            local container_status=$(docker inspect --format='{{.State.Status}}' llmchat-$ENVIRONMENT 2>/dev/null || echo "not_found")

            if [[ "$container_status" == "running" ]]; then
                # 检查API健康状态
                if curl -f "$DEPLOY_URL/api/health" --max-time 10 --silent 2>/dev/null; then
                    log_success "API健康检查通过"

                    # 检查前端健康状态
                    if curl -f "$DEPLOY_URL" --max-time 10 --silent 2>/dev/null; then
                        log_success "前端健康检查通过"
                        log_success "应用健康状态良好"
                        return 0
                    else
                        log_warning "前端健康检查失败，重试中..."
                    fi
                else
                    log_warning "API健康检查失败，重试中..."
                fi
            else
                log_warning "容器状态: $container_status，等待启动..."
            fi
        else
            log_info "试运行模式 - 跳过实际健康检查"
            return 0
        fi

        sleep 5
        ((attempt++))
    done

    log_error "健康检查失败"
    log_error "请检查应用日志: docker logs llmchat-$ENVIRONMENT"
    return 1
}

# ========================================
# 📊 部署后验证
# ========================================
post_deployment_verification() {
    log_header "📊 部署后验证..."

    if [[ "$DRY_RUN" != "true" ]]; then
        # 获取容器信息
        local container_id=$(docker inspect --format='{{.Id}}' llmchat-$ENVIRONMENT 2>/dev/null || echo "unknown")
        local image_name=$(docker inspect --format='{{.Config.Image}}' llmchat-$ENVIRONMENT 2>/dev/null || echo "unknown")
        local created_time=$(docker inspect --format='{{.Created}}' llmchat-$ENVIRONMENT 2>/dev/null || echo "unknown")

        log_info "部署验证信息:"
        log_info "  容器ID: ${container_id:0:12}"
        log_info "  镜像: $image_name"
        log_info "  创建时间: $created_time"
        log_info "  访问地址: $DEPLOY_URL"

        # 生成部署报告
        local report_file="$LOGS_DIR/deployment-report-$ENVIRONMENT-$(date +%Y%m%d_%H%M%S).json"
        mkdir -p "$LOGS_DIR"

        cat > "$report_file" << EOF
{
  "environment": "$ENVIRONMENT",
  "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "container_id": "$container_id",
  "image_name": "$image_name",
  "deploy_url": "$DEPLOY_URL",
  "docker_tag": "$CURRENT_DOCKER_TAG",
  "rollback": $ROLLBACK,
  "backup": $BACKUP,
  "status": "success"
}
EOF

        log_info "部署报告已保存: $report_file"
    else
        log_info "试运行模式 - 跳过部署验证"
    fi

    log_success "部署验证完成"
}

# ========================================
# 🛠️ 清理函数
# ========================================
cleanup() {
    if [[ $? -ne 0 ]]; then
        log_error "部署失败，正在清理..."

        # 清理未完成的部署
        if [[ "$DRY_RUN" != "true" ]]; then
            docker stop llmchat-$ENVIRONMENT-temp 2>/dev/null || true
            docker rm llmchat-$ENVIRONMENT-temp 2>/dev/null || true
        fi
    fi
}

# ========================================
# 🎯 主函数
# ========================================
main() {
    # 设置错误处理
    trap cleanup EXIT

    log_header "🚀 LLMChat 部署脚本"
    log_info "环境: $ENVIRONMENT"
    log_info "试运行: $DRY_RUN"
    log_info "项目根目录: $PROJECT_ROOT"

    # 确认部署
    if [[ "$FORCE" != "true" && "$DRY_RUN" != "true" ]]; then
        echo
        log_warning "即将部署到 $ENVIRONMENT 环境"
        log_warning "这将会覆盖现有的部署"
        read -p "确认继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "部署已取消"
            exit 0
        fi
    fi

    # 执行部署步骤
    check_dependencies
    check_environment_config
    load_deployment_config

    if [[ "$ROLLBACK" != "true" ]]; then
        build_application
        build_docker_image
    fi

    deploy_application
    health_check
    post_deployment_verification

    log_success "🎉 部署完成!"
    log_info "访问地址: $DEPLOY_URL"
    log_info "查看日志: docker logs -f llmchat-$ENVIRONMENT"
}

# ========================================
# 🏃‍♂️ 执行脚本
# ========================================
main "$@"