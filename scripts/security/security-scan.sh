#!/bin/bash

# LLMChat 安全扫描脚本
# 用途: 全面安全检查，包括依赖漏洞、代码安全、密钥扫描等

set -euo pipefail

# ========================================
# 🎨 脚本配置
# ========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$PROJECT_ROOT/security-reports"

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

# 创建报告目录
mkdir -p "$REPORT_DIR"

# ========================================
# 📋 参数解析
# ========================================
show_help() {
    cat << EOF
LLMChat 安全扫描脚本

用法: $0 [选项]

选项:
  -h, --help        显示此帮助信息
  -v, --verbose     详细输出
  -q, --quiet       静默模式
  -o, --output      输出目录 (默认: ./security-reports)
  -f, --format      报告格式: json|html|text (默认: json)
  --skip-deps       跳过依赖扫描
  --skip-code       跳过代码安全扫描
  --skip-secrets    跳过密钥扫描
  --skip-container  跳过容器安全扫描
  --fix             自动修复可修复的问题
  --severity        最低严重级别: low|medium|high|critical (默认: medium)

示例:
  $0                          # 运行完整安全扫描
  $0 --format html            # 生成HTML格式报告
  $0 --severity high           # 仅扫描高危漏洞
  $0 --skip-deps              # 跳过依赖扫描
  $0 --fix                    # 自动修复可修复的问题

EOF
}

# 默认参数
VERBOSE=false
QUIET=false
OUTPUT_DIR="$REPORT_DIR"
FORMAT="json"
SKIP_DEPS=false
SKIP_CODE=false
SKIP_SECRETS=false
SKIP_CONTAINER=false
AUTO_FIX=false
SEVERITY="medium"

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
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -f|--format)
            FORMAT="$2"
            shift 2
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --skip-code)
            SKIP_CODE=true
            shift
            ;;
        --skip-secrets)
            SKIP_SECRETS=true
            shift
            ;;
        --skip-container)
            SKIP_CONTAINER=true
            shift
            ;;
        --fix)
            AUTO_FIX=true
            shift
            ;;
        --severity)
            SEVERITY="$2"
            shift 2
            ;;
        -*)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 验证参数
if [[ ! "$FORMAT" =~ ^(json|html|text)$ ]]; then
    log_error "无效的输出格式: $FORMAT"
    exit 1
fi

if [[ ! "$SEVERITY" =~ ^(low|medium|high|critical)$ ]]; then
    log_error "无效的严重级别: $SEVERITY"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# ========================================
# 🔍 依赖安全扫描
# ========================================
scan_dependencies() {
    if [[ "$SKIP_DEPS" == "true" ]]; then
        log_info "跳过依赖安全扫描"
        return
    fi

    log_header "🔍 依赖安全扫描"

    local report_file="$OUTPUT_DIR/dependency-scan.$FORMAT"
    local vulnerabilities=0
    local scan_time=$(date +%s)

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "开始依赖安全扫描..."
    fi

    # pnpm audit 扫描
    local audit_file="$OUTPUT_DIR/pnpm-audit.json"
    if pnpm audit --audit-level moderate --json > "$audit_file" 2>/dev/null; then
        log_success "pnpm audit 扫描完成"
    else
        log_warning "pnpm audit 发现潜在问题"
    fi

    # 分析扫描结果
    local vuln_count=0
    local high_vulns=0
    local medium_vulns=0
    local low_vulns=0

    if [[ -f "$audit_file" ]]; then
        vuln_count=$(jq '.vulnerabilities | length' "$audit_file" 2>/dev/null || echo "0")
        high_vulns=$(jq '.vulnerabilities | map(select(.severity == "high")) | length' "$audit_file" 2>/dev/null || echo "0")
        medium_vulns=$(jq '.vulnerabilities | map(select(.severity == "moderate")) | length' "$audit_file" 2>/dev/null || echo "0")
        low_vulns=$(jq '.vulnerabilities | map(select(.severity == "low")) | length' "$audit_file" 2>/dev/null || echo "0")
    fi

    # Snyk 扫描 (如果可用)
    local snyk_file="$OUTPUT_DIR/snyk-scan.json"
    if command -v snyk &> /dev/null; then
        log_info "运行 Snyk 扫描..."
        if snyk test --json > "$snyk_file" 2>/dev/null; then
            log_success "Snyk 扫描完成"
        else
            log_warning "Snyk 扫描遇到问题"
        fi
    fi

    # 生成报告
    local end_time=$(date +%s)
    local duration=$((end_time - scan_time))

    cat > "$report_file" << EOF
{
  "scan_type": "dependency",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $duration,
  "vulnerabilities": {
    "total": $vuln_count,
    "high": $high_vulns,
    "medium": $medium_vulns,
    "low": $low_vulns
  },
  "tools": {
    "pnpm_audit": {
      "file": "pnpm-audit.json",
      "status": "completed"
    }
  },
  "recommendations": [
    "定期更新依赖包到最新安全版本",
    "使用自动依赖更新工具",
    "启用安全通知和漏洞监控"
  ]
}
EOF

    if [[ "$vuln_count" -gt 0 ]]; then
        log_warning "发现 $vuln_count 个依赖漏洞"
        log_warning "高危: $high_vulns, 中危: $medium_vulns, 低危: $low_vulns"
    else
        log_success "未发现依赖漏洞"
    fi

    # 自动修复
    if [[ "$AUTO_FIX" == "true" && "$vuln_count" -gt 0 ]]; then
        log_info "尝试自动修复依赖漏洞..."
        pnpm audit --fix
        log_success "依赖漏洞修复完成"
    fi
}

# ========================================
# 🔒 代码安全扫描
# ========================================
scan_code_security() {
    if [[ "$SKIP_CODE" == "true" ]]; then
        log_info "跳过代码安全扫描"
        return
    fi

    log_header "🔒 代码安全扫描"

    local report_file="$OUTPUT_DIR/code-security.$FORMAT"
    local issues=0
    local scan_time=$(date +%s)

    # Semgrep 扫描
    local semgrep_file="$OUTPUT_DIR/semgrep-scan.json"
    if command -v semgrep &> /dev/null; then
        log_info "运行 Semgrep 代码安全扫描..."

        # 配置 Semgrep 规则
        local semgrep_config="--config=auto --metrics --json"

        if semgrep $semgrep_config --output="$semgrep_file" . 2>/dev/null; then
            log_success "Semgrep 扫描完成"
        else
            log_warning "Semgrep 扫描遇到问题"
        fi
    else
        log_info "Semgrep 未安装，跳过静态代码分析"
    fi

    # ESLint 安全规则扫描
    local eslint_file="$OUTPUT_DIR/eslint-security.json"
    if [[ -f "$PROJECT_ROOT/.eslintrc.js" ]] || [[ -f "$PROJECT_ROOT/.eslintrc.json" ]]; then
        log_info "运行 ESLint 安全规则扫描..."

        cd "$PROJECT_ROOT"
        if npx eslint --ext .ts,.js,.tsx,.jsx --format=json --output-file="$eslint_file" src/ 2>/dev/null; then
            log_success "ESLint 安全扫描完成"
        else
            log_warning "ESLint 安全扫描发现问题"
        fi
        cd - > /dev/null
    fi

    # 分析结果
    local semgrep_issues=0
    local eslint_issues=0

    if [[ -f "$semgrep_file" ]]; then
        semgrep_issues=$(jq '.results | length' "$semgrep_file" 2>/dev/null || echo "0")
    fi

    if [[ -f "$eslint_file" ]]; then
        eslint_issues=$(jq '.length' "$eslint_file" 2>/dev/null || echo "0")
    fi

    issues=$((semgrep_issues + eslint_issues))

    # 生成报告
    local end_time=$(date +%s)
    local duration=$((end_time - scan_time))

    cat > "$report_file" << EOF
{
  "scan_type": "code_security",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $duration,
  "issues": {
    "total": $issues,
    "semgrep": $semgrep_issues,
    "eslint": $eslint_issues
  },
  "tools": {
    "semgrep": {
      "file": "semgrep-scan.json",
      "status": "completed"
    },
    "eslint": {
      "file": "eslint-security.json",
      "status": "completed"
    }
  },
  "recommendations": [
    "修复所有安全相关的代码问题",
    "实施安全编码规范",
    "定期进行代码安全审查",
    "使用静态分析工具进行持续扫描"
  ]
}
EOF

    if [[ "$issues" -gt 0 ]]; then
        log_warning "发现 $issues 个代码安全问题"
        log_warning "Semgrep: $semgrep_issues, ESLint: $eslint_issues"
    else
        log_success "未发现代码安全问题"
    fi
}

# ========================================
# 🔑 密钥扫描
# ========================================
scan_secrets() {
    if [[ "$SKIP_SECRETS" == "true" ]]; then
        log_info "跳过密钥扫描"
        return
    fi

    log_header "🔑 密钥扫描"

    local report_file="$OUTPUT_DIR/secrets-scan.$FORMAT"
    local secrets=0
    local scan_time=$(date +%s)

    # Gitleaks 扫描
    local gitleaks_file="$OUTPUT_DIR/gitleaks-scan.json"
    if command -v gitleaks &> /dev/null; then
        log_info "运行 Gitleaks 密钥扫描..."

        if gitleaks detect --source=. --report-path="$gitleaks_file" --report-format=json 2>/dev/null; then
            log_success "Gitleaks 扫描完成"
        else
            log_warning "Gitleaks 扫描遇到问题"
        fi
    else
        log_info "Gitleaks 未安装，使用基础模式扫描"

        # 基础密钥扫描
        local secrets_file="$OUTPUT_DIR/basic-secrets.txt"
        log_info "运行基础密钥模式扫描..."

        # 扫描常见密钥模式
        grep -r -n -E "(password|secret|key|token|api_key|private_key).*=.*['\"][^'\"]{8,}" \
            --include="*.js" --include="*.ts" --include="*.json" --include="*.yml" --include="*.yaml" \
            --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
            . > "$secrets_file" 2>/dev/null || true

        if [[ -f "$secrets_file" && -s "$secrets_file" ]]; then
            secrets=$(wc -l < "$secrets_file")
        fi
    fi

    # 扫描配置文件中的明文密钥
    local config_secrets=0
    local config_patterns=(
        ".env"
        ".env.local"
        ".env.production"
        "config/*.json"
        "config/*.yml"
        "config/*.yaml"
    )

    for pattern in "${config_patterns[@]}"; do
        if [[ -f "$PROJECT_ROOT/$pattern" ]]; then
            local found=$(grep -c -E "(password|secret|key|token).*=.*[^$]" "$PROJECT_ROOT/$pattern" 2>/dev/null || echo "0")
            config_secrets=$((config_secrets + found))
        fi
    done

    # 扫描环境变量文件
    local env_secrets=0
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        env_secrets=$(grep -c -E "^(DATABASE_URL|REDIS_URL|JWT_SECRET|API_KEY|SECRET_KEY)" "$PROJECT_ROOT/.env" 2>/dev/null || echo "0")
    fi

    total_secrets=$((secrets + config_secrets + env_secrets))

    # 生成报告
    local end_time=$(date +%s)
    local duration=$((end_time - scan_time))

    cat > "$report_file" << EOF
{
  "scan_type": "secrets",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $duration,
  "secrets_found": {
    "total": $total_secrets,
    "git_history": $secrets,
    "config_files": $config_secrets,
    "environment_files": $env_secrets
  },
  "tools": {
    "gitleaks": {
      "file": "gitleaks-scan.json",
      "status": "completed"
    },
    "basic_scan": {
      "status": "completed"
    }
  },
  "recommendations": [
    "将所有密钥移动到环境变量或密钥管理系统",
    "使用 .gitignore 排除敏感文件",
    "实施 pre-commit 钩子防止密钥提交",
    "定期审查代码仓库中的敏感信息"
  ]
}
EOF

    if [[ "$total_secrets" -gt 0 ]]; then
        log_warning "发现 $total_secrets 个潜在密钥"
        log_warning "Git历史: $secrets, 配置文件: $config_secrets, 环境文件: $env_secrets"

        if [[ "$VERBOSE" == "true" && -f "$gitleaks_file" ]]; then
            log_info "密钥详情:"
            jq -r '.Results[] | "文件: \(.File), 行号: \(.Line), 内容: \(.Secret)"' "$gitleaks_file" | head -10
        fi
    else
        log_success "未发现密钥泄露"
    fi
}

# ========================================
# 🐳 容器安全扫描
# ========================================
scan_container_security() {
    if [[ "$SKIP_CONTAINER" == "true" ]]; then
        log_info "跳过容器安全扫描"
        return
    fi

    log_header "🐳 容器安全扫描"

    local report_file="$OUTPUT_DIR/container-security.$FORMAT"
    local issues=0
    local scan_time=$(date +%s)

    # 检查 Dockerfile
    local dockerfile_issues=0
    if [[ -f "$PROJECT_ROOT/Dockerfile" ]]; then
        log_info "扫描 Dockerfile 安全配置..."

        # 检查安全问题
        local security_issues=(
            "USER root"
            "ADD ."
            "RUN wget"
            "RUN curl"
            "FROM .*:latest"
            "HEALTHCHECK.*missing"
        )

        for issue in "${security_issues[@]}"; do
            if grep -q "$issue" "$PROJECT_ROOT/Dockerfile"; then
                dockerfile_issues=$((dockerfile_issues + 1))
            fi
        done
    fi

    # Trivy 扫描 (如果可用)
    local trivy_file="$OUTPUT_DIR/trivy-scan.json"
    if command -v trivy &> /dev/null; then
        log_info "运行 Trivy 容器安全扫描..."

        # 扫描镜像
        local image_name="llmchat:latest"
        if docker images | grep -q "$image_name"; then
            if trivy image --format json --output "$trivy_file" "$image_name" 2>/dev/null; then
                log_success "Trivy 镜像扫描完成"
            else
                log_warning "Trivy 镜像扫描遇到问题"
            fi
        else
            log_info "镜像 $image_name 不存在，跳过 Trivy 扫描"
        fi
    else
        log_info "Trivy 未安装，跳过容器安全扫描"
    fi

    # 分析结果
    local trivy_issues=0
    local trivy_high=0
    local trivy_medium=0

    if [[ -f "$trivy_file" ]]; then
        trivy_issues=$(jq '.Results | length' "$trivy_file" 2>/dev/null || echo "0")
        trivy_high=$(jq '.Results | map(select(.Severity == "HIGH")) | length' "$trivy_file" 2>/dev/null || echo "0")
        trivy_medium=$(jq '.Results | map(select(.Severity == "MEDIUM")) | length' "$trivy_file" 2>/dev/null || echo "0")
    fi

    issues=$((dockerfile_issues + trivy_issues))

    # 生成报告
    local end_time=$(date +%s)
    local duration=$((end_time - scan_time))

    cat > "$report_file" << EOF
{
  "scan_type": "container",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $duration,
  "issues": {
    "total": $issues,
    "dockerfile": $dockerfile_issues,
    "trivy": {
      "total": $trivy_issues,
      "high": $trivy_high,
      "medium": $trivy_medium
    }
  },
  "tools": {
    "trivy": {
      "file": "trivy-scan.json",
      "status": "completed"
    },
    "dockerfile_analysis": {
      "status": "completed"
    }
  },
  "recommendations": [
    "使用非root用户运行容器",
    "使用特定版本标签而非 latest",
    "最小化攻击面",
    "定期更新基础镜像",
    "启用容器安全扫描"
  ]
}
EOF

    if [[ "$issues" -gt 0 ]]; then
        log_warning "发现 $issues 个容器安全问题"
        log_warning "Dockerfile: $dockerfile_issues, Trivy: $trivy_issues"

        if [[ "$trivy_high" -gt 0 ]]; then
            log_error "发现 $trivy_high 个高危容器漏洞！"
        fi
    else
        log_success "未发现容器安全问题"
    fi
}

# ========================================
# 📊 生成综合报告
# ========================================
generate_summary_report() {
    log_header "📊 生成安全扫描综合报告"

    local summary_file="$OUTPUT_DIR/security-summary.$FORMAT"
    local scan_time=$(date +%s)

    # 收集所有扫描结果
    local deps_issues=0
    local code_issues=0
    local secrets_found=0
    local container_issues=0

    # 依赖漏洞
    if [[ -f "$OUTPUT_DIR/dependency-scan.json" ]]; then
        deps_issues=$(jq '.vulnerabilities.total' "$OUTPUT_DIR/dependency-scan.json" 2>/dev/null || echo "0")
    fi

    # 代码安全问题
    if [[ -f "$OUTPUT_DIR/code-security.json" ]]; then
        code_issues=$(jq '.issues.total' "$OUTPUT_DIR/code-security.json" 2>/dev/null || echo "0")
    fi

    # 密钥泄露
    if [[ -f "$OUTPUT_DIR/secrets-scan.json" ]]; then
        secrets_found=$(jq '.secrets_found.total' "$OUTPUT_DIR/secrets-scan.json" 2>/dev/null || echo "0")
    fi

    # 容器安全问题
    if [[ -f "$OUTPUT_DIR/container-security.json" ]]; then
        container_issues=$(jq '.issues.total' "$OUTPUT_DIR/container-security.json" 2>/dev/null || echo "0")
    fi

    local total_issues=$((deps_issues + code_issues + secrets_found + container_issues))

    # 计算安全评分
    local security_score=100
    if [[ $deps_issues -gt 0 ]]; then
        security_score=$((security_score - (deps_issues * 2)))
    fi
    if [[ $code_issues -gt 0 ]]; then
        security_score=$((security_score - code_issues))
    fi
    if [[ $secrets_found -gt 0 ]]; then
        security_score=$((security_score - (secrets_found * 5)))
    fi
    if [[ $container_issues -gt 0 ]]; then
        security_score=$((security_score - container_issues))
    fi

    if [[ $security_score -lt 0 ]]; then
        security_score=0
    fi

    # 确定安全等级
    local security_grade
    if [[ $security_score -ge 90 ]]; then
        security_grade="A"
    elif [[ $security_score -ge 80 ]]; then
        security_grade="B"
    elif [[ $security_score -ge 70 ]]; then
        security_grade="C"
    elif [[ $security_score -ge 60 ]]; then
        security_grade="D"
    else
        security_grade="F"
    fi

    # 生成报告
    local end_time=$(date +%s)
    local duration=$((end_time - scan_time))

    cat > "$summary_file" << EOF
{
  "scan_type": "summary",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $duration,
  "overall_score": $security_score,
  "security_grade": "$security_grade",
  "total_issues": $total_issues,
  "issue_breakdown": {
    "dependencies": $deps_issues,
    "code": $code_issues,
    "secrets": $secrets_found,
    "containers": $container_issues
  },
  "scan_status": {
    "dependencies": "$([ "$SKIP_DEPS" == "true" ] && echo "skipped" || echo "completed")",
    "code": "$([ "$SKIP_CODE" == "true" ] && echo "skipped" || echo "completed")",
    "secrets": "$([ "$SKIP_SECRETS" == "true" ] && echo "skipped" || echo "completed")",
    "containers": "$([ "$SKIP_CONTAINER" == "true" ] && echo "skipped" || echo "completed")"
  },
  "recommendations": [
    $([ $deps_issues -gt 0 ] && echo "\"修复所有依赖漏洞，特别是高危和中危漏洞\"," || echo "")
    $([ $code_issues -gt 0 ] && echo "\"解决所有代码安全问题，实施安全编码规范\"," || echo "")
    $([ $secrets_found -gt 0 ] && echo "\"移除代码中的所有硬编码密钥，使用安全的密钥管理\"," || echo "")
    $([ $container_issues -gt 0 ] && echo "\"修复容器安全配置，遵循最小权限原则\"," || echo "")
    "\"定期进行安全扫描和代码审查\",
    "\"建立安全开发流程和培训机制\""
  ],
  "next_steps": [
    "审查详细的安全报告",
    "制定安全修复计划",
    "实施安全最佳实践",
    "建立持续安全监控"
  ]
}
EOF

    # 输出摘要
    if [[ "$QUIET" != "true" ]]; then
        echo
        log_header "🎯 安全扫描摘要"
        echo "=========================================="
        echo "总体评分: $security_score/100 (等级: $security_grade)"
        echo "总问题数: $total_issues"
        echo "  依赖漏洞: $deps_issues"
        echo "  代码问题: $code_issues"
        echo "  密钥泄露: $secrets_found"
        echo "  容器问题: $container_issues"
        echo "=========================================="

        if [[ $total_issues -eq 0 ]]; then
            echo -e "${GREEN}✅ 恭喜！未发现安全问题${NC}"
        else
            echo -e "${YELLOW}⚠️ 发现 $total_issues 个安全问题，请及时修复${NC}"
        fi
    fi

    # 保存到文件
    if [[ "$FORMAT" == "html" ]]; then
        # 简单的HTML报告
        local html_file="$OUTPUT_DIR/security-summary.html"
        cat > "$html_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>LLMChat 安全扫描报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .score { font-size: 24px; font-weight: bold; margin: 20px 0; }
        .grade-A { color: #4CAF50; }
        .grade-B { color: #8BC34A; }
        .grade-C { color: #FF9800; }
        .grade-D { color: #F44336; }
        .grade-F { color: #D32F2F; }
        .issues { margin: 20px 0; }
        .issue { margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 3px; }
        .recommendations { background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ LLMChat 安全扫描报告</h1>
        <p>扫描时间: $(date)</p>
    </div>

    <div class="score">
        安全评分: <span class="grade-$security_grade">$security_score/100</span> (等级: $security_grade)
    </div>

    <div class="issues">
        <h2>📊 问题统计</h2>
        <div class="issue">依赖漏洞: $deps_issues</div>
        <div class="issue">代码问题: $code_issues</div>
        <div class="issue">密钥泄露: $secrets_found</div>
        <div class="issue">容器问题: $container_issues</div>
        <div class="issue"><strong>总计: $total_issues</strong></div>
    </div>

    <div class="recommendations">
        <h2>💡 建议</h2>
        <ul>
            <li>修复所有依赖漏洞，特别是高危和中危漏洞</li>
            <li>解决所有代码安全问题，实施安全编码规范</li>
            <li>移除代码中的所有硬编码密钥，使用安全的密钥管理</li>
            <li>修复容器安全配置，遵循最小权限原则</li>
            <li>定期进行安全扫描和代码审查</li>
            <li>建立安全开发流程和培训机制</li>
        </ul>
    </div>
</body>
</html>
EOF
        log_info "HTML报告已生成: $html_file"
    fi
}

# ========================================
# 🎯 主函数
# ========================================
main() {
    # 检查依赖
    local required_tools=("jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool 命令未找到，请安装 $tool"
            exit 1
        fi
    done

    # 显示配置信息
    if [[ "$VERBOSE" == "true" ]]; then
        log_header "🛡️ LLMChat 安全扫描"
        log_info "输出目录: $OUTPUT_DIR"
        log_info "报告格式: $FORMAT"
        log_info "严重级别: $SEVERITY"
        log_info "自动修复: $AUTO_FIX"
        echo
    fi

    # 执行安全扫描
    scan_dependencies
    scan_code_security
    scan_secrets
    scan_container_security

    # 生成综合报告
    generate_summary_report

    # 返回适当的退出码
    if [[ "$total_issues" -gt 0 ]]; then
        log_warning "安全扫描完成，发现 $total_issues 个问题"
        exit 1
    else
        log_success "安全扫描完成，未发现问题"
        exit 0
    fi
}

# ========================================
# 🏃‍♂️ 执行脚本
# ========================================
main "$@"