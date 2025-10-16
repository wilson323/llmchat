#!/bin/bash

# 构建恢复脚本 - 解决WSL2环境下的rollup依赖问题
set -e

echo "🔧 Frontend Build Recovery Script for WSL2"
echo "========================================"

# 步骤1: 环境检测
echo "📋 Step 1: Platform Detection"
echo "OS: $(uname -s)"
echo "Arch: $(uname -m)"
echo "WSL: $(test -f /proc/version && grep -qi microsoft /proc/version && echo 'Yes' || echo 'No')"
echo "Node: $(node --version)"
echo "PNPM: $(pnpm --version)"
echo ""

# 步骤2: 清理问题依赖
echo "🧹 Step 2: Cleaning Problematic Dependencies"
echo "Removing Windows-specific rollup packages..."

# 清理Windows特定的rollup包
rm -rf node_modules/.pnpm/@rollup+rollup-win32-x64-msvc* 2>/dev/null || true
rm -rf node_modules/.pnpm/@rollup+rollup-linux-x64-gnu* 2>/dev/null || true
rm -rf node_modules/.pnpm/@rollup+rollup-darwin-x64* 2>/dev/null || true

# 清理缓存
rm -rf .vite 2>/dev/null || true
rm -rf dist 2>/dev/null || true

echo "✅ Cleaned problematic packages"
echo ""

# 步骤3: 重新安装依赖
echo "📦 Step 3: Reinstalling Dependencies"
echo "Using --force to ensure clean installation..."

pnpm install --force --prefer-frozen-lockfile || {
    echo "⚠️ Force install failed, trying regular install..."
    pnpm install
}

echo "✅ Dependencies reinstalled"
echo ""

# 步骤4: 验证关键依赖
echo "🔍 Step 4: Verifying Key Dependencies"

# 检查rollup是否正确安装
ROLLUP_VERSION=$(pnpm list rollup 2>/dev/null | grep rollup | head -1 || echo "Not found")
echo "Rollup: $ROLLUP_VERSION"

# 检查Vite是否正确安装
VITE_VERSION=$(pnpm list vite 2>/dev/null | grep vite | head -1 || echo "Not found")
echo "Vite: $VITE_VERSION"

echo ""

# 步骤5: 使用简化配置构建
echo "🏗️ Step 5: Building with Simplified Configuration"

# 备份原始配置
if [ -f "vite.config.ts" ] && [ ! -f "vite.config.backup.ts" ]; then
    cp vite.config.ts vite.config.backup.ts
    echo "✅ Backed up original vite.config.ts"
fi

# 使用简化配置
if [ -f "vite.config.simple.ts" ]; then
    cp vite.config.simple.ts vite.config.ts
    echo "✅ Using simplified vite configuration"
fi

# 尝试构建
echo "🚀 Starting build process..."
BUILD_START=$(date +%s)

if pnpm run build; then
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    echo ""
    echo "🎉 Build successful!"
    echo "⏱️ Build time: ${BUILD_TIME}s"

    # 验证构建结果
    if [ -d "dist" ]; then
        DIST_SIZE=$(du -sh dist | cut -f1)
        FILE_COUNT=$(find dist -type f | wc -l)
        echo "📊 Build statistics:"
        echo "   - Dist size: $DIST_SIZE"
        echo "   - File count: $FILE_COUNT"
    fi

    echo ""
    echo "✅ Build recovery completed successfully!"

else
    echo ""
    echo "❌ Build failed!"
    echo ""
    echo "🔍 Trouleshooting steps:"

    # 检查常见的WSL2问题
    if [ -f "node_modules/.pnpm/@rollup+rollup-win32-x64-msvc" ]; then
        echo "   ⚠️ Windows-specific rollup package detected"
        echo "   💡 Run: rm -rf node_modules && pnpm install"
    fi

    # 检查磁盘空间
    DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        echo "   ⚠️ Low disk space: ${DISK_USAGE}% used"
        echo "   💡 Free up disk space and retry"
    fi

    # 检查内存
    MEM_AVAILABLE=$(free | grep Mem | awk '{printf "%.0f", $7/$2 * 100.0}')
    if [ "$MEM_AVAILABLE" -lt 10 ]; then
        echo "   ⚠️ Low memory: ${MEM_AVAILABLE}% available"
        echo "   💡 Close other applications and retry"
    fi

    echo ""
    echo "📋 Additional diagnostics:"
    echo "   - Check Node.js version compatibility"
    echo "   - Verify pnpm installation integrity"
    echo "   - Try: pnpm store prune && pnpm install"

    exit 1
fi

echo ""
echo "🎯 Next steps:"
echo "   1. Test the build output: pnpm run preview"
echo "   2. Run type checking: pnpm run type-check"
echo "   3. Run linting: pnpm run lint"
echo ""