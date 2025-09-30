@echo off
chcp 65001 >nul 2>&1

REM 环境测试脚本 - 快速检查环境是否正常

echo ════════════════════════════════════════
echo   LLMChat 环境测试
echo ════════════════════════════════════════
echo.

echo [测试 1] 检查 Node.js
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Node.js:
    node -v
) else (
    echo ✗ Node.js 未安装
)
echo.

echo [测试 2] 检查 npm
where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ npm:
    npm -v
) else (
    echo ✗ npm 未安装
)
echo.

echo [测试 3] 检查项目文件
if exist "package.json" (
    echo ✓ package.json 存在
) else (
    echo ✗ package.json 不存在
)

if exist "backend\.env" (
    echo ✓ backend\.env 存在
) else (
    echo ✗ backend\.env 不存在
)

if exist "config\agents.json" (
    echo ✓ config\agents.json 存在
) else (
    echo ✗ config\agents.json 不存在
)
echo.

echo [测试 4] 检查依赖
if exist "node_modules" (
    echo ✓ 根目录 node_modules 存在
) else (
    echo ✗ 根目录 node_modules 不存在
)

if exist "backend\node_modules" (
    echo ✓ 后端 node_modules 存在
) else (
    echo ✗ 后端 node_modules 不存在
)

if exist "frontend\node_modules" (
    echo ✓ 前端 node_modules 存在
) else (
    echo ✗ 前端 node_modules 不存在
)

if exist "node_modules\concurrently" (
    echo ✓ concurrently 已安装
) else (
    echo ✗ concurrently 未安装
)
echo.

echo [测试 5] 检查端口占用
netstat -ano | findstr ":3000 :3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠ 端口 3000 或 3001 已被占用:
    netstat -ano | findstr ":3000 :3001"
) else (
    echo ✓ 端口 3000 和 3001 可用
)
echo.

echo [测试 6] 检查 npm 脚本
npm run 2>nul | findstr /C:"dev" >nul
if %errorlevel% equ 0 (
    echo ✓ npm run dev 脚本已配置
) else (
    echo ✗ npm run dev 脚本未配置
)
echo.

echo ════════════════════════════════════════
echo   测试完成！
echo ════════════════════════════════════════
echo.
echo 如果所有测试都显示 ✓，可以运行:
echo   start-dev.bat
echo.
echo 如果有错误 (✗)，请先解决问题:
echo   1. ✗ Node.js/npm: 安装 Node.js 18+
echo   2. ✗ 配置文件: 运行 start-dev-debug.bat
echo   3. ✗ 依赖: 运行 npm install
echo   4. ⚠ 端口占用: 关闭占用端口的程序
echo.
pause