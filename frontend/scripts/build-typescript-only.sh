#!/bin/bash

# TypeScript only build - 绕过Vite/rollup依赖问题
set -e

echo "🔧 TypeScript Only Build - WSL2 Environment Fix"
echo "=============================================="

# 步骤1: TypeScript编译
echo "📝 Step 1: TypeScript Compilation"
echo "Compiling TypeScript files..."

# 创建dist目录
mkdir -p dist

# 使用宽松的TypeScript配置进行编译
npx tsc --project tsconfig.build.json

if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# 步骤2: 复制静态资源
echo "📁 Step 2: Copying Static Assets"
echo "Copying static files to dist..."

# 复制public目录内容
cp -r public/* dist/ 2>/dev/null || true

# 复制index.html
if [ -f "index.html" ]; then
    cp index.html dist/
    echo "✅ Copied index.html"
fi

# 步骤3: 生成基本的构建信息
echo "📊 Step 3: Generating Build Info"
BUILD_TIME=$(date -Iseconds)
BUILD_VERSION=$(node -p "require('./package.json').version")

cat > dist/build-info.json << EOF
{
  "buildTime": "$BUILD_TIME",
  "version": "$BUILD_VERSION",
  "mode": "typescript-only",
  "environment": "wsl2-optimized"
}
EOF

echo "✅ Generated build info"

# 步骤4: 统计构建结果
echo "📈 Step 4: Build Statistics"
if [ -d "dist" ]; then
    FILE_COUNT=$(find dist -type f | wc -l)
    DIST_SIZE=$(du -sh dist | cut -f1)

    echo "✅ Build completed successfully!"
    echo "📊 Statistics:"
    echo "   - Files created: $FILE_COUNT"
    echo "   - Total size: $DIST_SIZE"
    echo "   - Build mode: TypeScript only"
    echo "   - Environment: WSL2 optimized"

    # 列出主要文件
    echo ""
    echo "📁 Main files created:"
    find dist -name "*.js" -o -name "*.html" -o -name "*.css" | head -10

else
    echo "❌ No dist directory found"
    exit 1
fi

echo ""
echo "🎯 Next steps:"
echo "   1. Serve the dist directory: npx serve dist"
echo "   2. Test the application locally"
echo "   3. Deploy to production when ready"
echo ""
echo "🚀 TypeScript-only build completed!"