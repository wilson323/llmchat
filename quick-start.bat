@echo off
chcp 65001 >nul 2>&1

REM 切换到脚本所在目录
cd /d "%~dp0"

echo 🚀 启动 LLMChat...
echo.

REM 快速检查
if not exist "node_modules\.pnpm" (
    echo ⚠ 依赖未安装，正在安装...
    pnpm install
    echo.
)

call pnpm run dev

REM 如果失败，提示用户
if %errorlevel% neq 0 (
    echo.
    echo ❌ 启动失败！请尝试使用 start-dev-debug.bat 查看详细信息
    pause
)