@echo off
chcp 65001 >nul 2>&1

REM LLMChat 调试启动脚本 (Windows)
REM 用途：带详细调试信息的启动脚本

title LLMChat 调试模式

echo ═══════════════════════════════════════════════════
echo   LLMChat 调试启动脚本
echo ═══════════════════════════════════════════════════
echo.

echo [调试] 当前目录: %CD%
echo [调试] 脚本路径: %~dp0
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"
echo [调试] 已切换到: %CD%
echo.

echo [1/8] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Node.js 未安装！
    echo [提示] 请从 https://nodejs.org/ 下载安装 Node.js 18+
    pause
    exit /b 1
)
node -v
echo [成功] Node.js 已安装
echo.

echo [2/8] 检查 npm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] pnpm 未安装！请先安装: npm install -g pnpm！
    pause
    exit /b 1
)
npm -v
echo [成功] npm 已安装
echo.

echo [3/8] 检查 package.json...
if not exist "package.json" (
    echo [错误] package.json 不存在！
    echo [提示] 请确保在项目根目录运行此脚本
    pause
    exit /b 1
)
echo [成功] package.json 存在
echo.

echo [4/8] 检查后端配置...
if not exist "backend\.env" (
    echo [警告] backend\.env 不存在
    if exist "backend\.env.example" (
        echo [提示] 正在创建 backend\.env...
        copy "backend\.env.example" "backend\.env" >nul
        echo [成功] 已创建 backend\.env
        echo [重要] 请编辑 backend\.env 配置必需项后重新运行！
        pause
        exit /b 0
    ) else (
        echo [错误] backend\.env.example 也不存在！
        pause
        exit /b 1
    )
) else (
    echo [成功] backend\.env 已存在
)
echo.

echo [5/8] 检查智能体配置...
if not exist "config\agents.json" (
    echo [警告] config\agents.json 不存在
    if exist "config\agents.example.json" (
        copy "config\agents.example.json" "config\agents.json" >nul
        echo [成功] 已创建 config\agents.json
    )
) else (
    echo [成功] config\agents.json 已存在
)
echo.

echo [6/8] 检查依赖...
if not exist "node_modules" (
    echo [警告] 根目录 node_modules 不存在，正在安装...
    call pnpm install
    if %errorlevel% neq 0 (
        echo [错误] 安装失败！
        pause
        exit /b 1
    )
) else (
    echo [成功] 根目录依赖已安装
)

if not exist "backend\node_modules" (
    echo [警告] backend 依赖不存在，正在安装...
    cd backend
    call pnpm install
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败！
        cd ..
        pause
        exit /b 1
    )
    cd ..
) else (
    echo [成功] 后端依赖已安装
)

if not exist "frontend\node_modules" (
    echo [警告] frontend 依赖不存在，正在安装...
    cd frontend
    call pnpm install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败！
        cd ..
        pause
        exit /b 1
    )
    cd ..
) else (
    echo [成功] 前端依赖已安装
)
echo.

echo [7/8] 检查 concurrently...
if not exist "node_modules\concurrently" (
    echo [错误] concurrently 未安装！
    echo [提示] 正在安装 concurrently...
    call pnpm install concurrently --save-dev
    if %errorlevel% neq 0 (
        echo [错误] concurrently 安装失败！
        pause
        exit /b 1
    )
) else (
    echo [成功] concurrently 已安装
)
echo.

echo [8/8] 检查 npm 脚本...
pnpm run 2>nul | findstr /C:"dev" >nul
if %errorlevel% neq 0 (
    echo [错误] 'pnpm run dev' 脚本不存在！
    echo [提示] 请检查 package.json 中的 scripts 配置
    echo.
    echo 当前可用的脚本:
    pnpm run
    pause
    exit /b 1
) else (
    echo [成功] dev 脚本已配置
)
echo.

echo ═══════════════════════════════════════════════════
echo   所有检查通过！准备启动服务...
echo ═══════════════════════════════════════════════════
echo.
echo 后端: http://localhost:3001
echo 前端: http://localhost:3000
echo.
echo 按 Ctrl+C 停止服务
echo ═══════════════════════════════════════════════════
echo.

REM 启动服务
call pnpm run dev

REM 捕获退出代码
set EXIT_CODE=%errorlevel%

echo.
echo ═══════════════════════════════════════════════════
if %EXIT_CODE% neq 0 (
    echo [错误] 服务异常退出，退出代码: %EXIT_CODE%
    echo.
    echo 可能的原因:
    echo 1. 端口被占用 (3000 或 3001)
    echo 2. 配置文件错误
    echo 3. 依赖缺失或版本不兼容
    echo.
    echo 排查步骤:
    echo 1. 检查端口: netstat -ano ^| findstr "3000 3001"
    echo 2. 查看上方详细错误信息
    echo 3. 尝试分别启动:
    echo    - pnpm run backend:dev
    echo    - pnpm run frontend:dev
) else (
    echo [信息] 服务已正常停止
)
echo ═══════════════════════════════════════════════════
pause
exit /b %EXIT_CODE%
