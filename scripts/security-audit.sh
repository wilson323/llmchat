#!/bin/bash

# 🛡️ 项目安全审计脚本
# 检测危险的正则表达式代码替换模式和其他安全问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
DANGEROUS_PATTERNS=0
SECURITY_ISSUES=0
TOTAL_FILES=0

echo -e "${BLUE}🔍 开始项目安全审计...${NC}"
echo "========================================"

# 危险模式列表
DANGEROUS_REGEX_PATTERNS=(
    "replace\(\/.*\/"
    "new RegExp\("
    "\.replace\(.*,"
    "sed.*-i.*s\/"
    "execSync.*sed"
    "execSync.*replace"
    "child_process.*exec"
    "eval.*replace"
    "Function.*replace"
)

# 安全检查函数
check_dangerous_patterns() {
    local file="$1"
    local issues=0

    for pattern in "${DANGEROUS_REGEX_PATTERNS[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            echo -e "${RED}🚨 发现危险模式: $pattern${NC}"
            echo -e "   文件: $file"
            grep -n "$pattern" "$file" | sed 's/^/   行 /'
            echo ""
            ((issues++))
            ((DANGEROUS_PATTERNS++))
        fi
    done

    return $issues
}

# 检查硬编码敏感信息
check_hardcoded_secrets() {
    local file="$1"
    local issues=0

    # 检查硬编码的API密钥、密码等
    if grep -qE "(sk-[a-zA-Z0-9]{20,}|password\s*=\s*[\"'][^\"']+[\"']|api_key\s*=\s*[\"'][^\"']+[\"'])" "$file" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  可能的硬编码敏感信息${NC}"
        echo -e "   文件: $file"
        grep -nE "(sk-[a-zA-Z0-9]{20,}|password\s*=\s*[\"'][^\"']+[\"']|api_key\s*=\s*[\"'][^\"']+[\"'])" "$file" | sed 's/^/   行 /'
        echo ""
        ((issues++))
        ((SECURITY_ISSUES++))
    fi

    return $issues
}

# 检查不安全的导入
check_unsafe_imports() {
    local file="$1"
    local issues=0

    # 检查eval和Function构造函数的使用
    if grep -qE "(eval\s*\(|new\s+Function\s*\()" "$file" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  不安全的代码执行${NC}"
        echo -e "   文件: $file"
        grep -nE "(eval\s*\(|new\s+Function\s*\()" "$file" | sed 's/^/   行 /'
        echo ""
        ((issues++))
        ((SECURITY_ISSUES++))
    fi

    return $issues
}

# 主审计函数
audit_file() {
    local file="$1"
    local file_issues=0

    # 跳过某些文件类型
    if [[ "$file" =~ \.(min|bundle|pack)\.(js|ts)$ ]]; then
        return 0
    fi

    # 跳过备份文件
    if [[ "$file" =~ \.(backup|tmp|bak)$ ]]; then
        return 0
    fi

    # 跳过node_modules和构建目录
    if [[ "$file" =~ (node_modules|dist|build|\.git) ]]; then
        return 0
    fi

    ((TOTAL_FILES++))

    # 执行各种安全检查
    check_dangerous_patterns "$file"
    file_issues=$((file_issues + $?))

    check_hardcoded_secrets "$file"
    file_issues=$((file_issues + $?))

    check_unsafe_imports "$file"
    file_issues=$((file_issues + $?))

    return $file_issues
}

# 递归审计目录
audit_directory() {
    local dir="$1"

    echo -e "${BLUE}📁 审计目录: $dir${NC}"

    while IFS= read -r -d '' file; do
        audit_file "$file"
    done < <(find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0)
}

# 检查特定危险文件
check_specific_dangerous_files() {
    echo -e "${BLUE}🔍 检查已知的危险文件类型...${NC}"

    # 检查是否存在可能的sanitize脚本
    if [ -f "sanitize-config.ts" ] || [ -f "sanitize-config.js" ]; then
        echo -e "${RED}🚨 发现潜在的sanitize配置文件${NC}"
        echo "   这些文件可能包含危险的代码替换逻辑"
        echo ""
        ((DANGEROUS_PATTERNS++))
    fi

    # 检查是否存在自动修复脚本
    if find . -name "*auto*fix*" -o -name "*code*fix*" -o -name "*sanitize*" | grep -v node_modules | grep -v .git | head -5; then
        echo -e "${YELLOW}⚠️  发现自动修复相关文件${NC}"
        echo "   请手动检查这些文件的安全性"
        echo ""
    fi
}

# 生成安全报告
generate_security_report() {
    echo "========================================"
    echo -e "${BLUE}📊 安全审计报告${NC}"
    echo "========================================"
    echo -e "扫描文件总数: ${GREEN}$TOTAL_FILES${NC}"
    echo -e "危险模式数量: ${RED}$DANGEROUS_PATTERNS${NC}"
    echo -e "安全问题数量: ${YELLOW}$SECURITY_ISSUES${NC}"
    echo ""

    if [ $DANGEROUS_PATTERNS -eq 0 ] && [ $SECURITY_ISSUES -eq 0 ]; then
        echo -e "${GREEN}✅ 安全审计通过！未发现危险模式。${NC}"
        echo -e "${GREEN}🎉 项目代码符合企业级安全标准。${NC}"
        return 0
    else
        echo -e "${RED}❌ 发现安全问题，需要立即处理！${NC}"
        echo ""
        echo -e "${YELLOW}📋 建议措施:${NC}"
        echo "1. 立即停止使用任何正则表达式进行代码替换"
        echo "2. 使用TypeScript Compiler API进行AST操作"
        echo "3. 实施企业级代码修复工具: pnpm run enterprise:fix"
        echo "4. 配置pre-commit钩子防止危险代码提交"
        echo "5. 定期运行安全审计: pnpm run security:audit"
        return 1
    fi
}

# 主函数
main() {
    echo -e "${BLUE}🛡️ 企业级项目安全审计工具${NC}"
    echo "检查危险的正则表达式代码替换模式和其他安全问题"
    echo ""

    # 检查当前目录
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ 错误: 当前目录不是有效的Node.js项目${NC}"
        exit 1
    fi

    # 检查特定的危险文件
    check_specific_dangerous_files

    # 审计主要源码目录
    for dir in "src" "lib" "scripts" "backend" "frontend"; do
        if [ -d "$dir" ]; then
            audit_directory "$dir"
        fi
    done

    # 生成最终报告
    echo ""
    generate_security_report
}

# 运行主函数
main "$@"