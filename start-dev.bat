@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM LLMChat 开发环境启动脚本 (Windows)
REM 用途：同时启动前端和后端开发服务器

title LLMChat 开发环境

echo.
echo ╔══════════════════════════════════════════════╗
echo ║     LLMChat 开发环境启动脚本                 ║
echo ╚══════════════════════════════════════════════╝
echo.
echo 当前目录: %CD%
echo.

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Node.js 未安装！请先安装 Node.js 18+
    pause
    exit /b 1
)
echo [成功] Node.js 版本:
node -v

REM 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] npm 未安装！
    pause
    exit /b 1
)
echo [成功] npm 版本:
npm -v

echo.
echo [信息] 检查配置文件...

REM 检查后端环境变量
if not exist "backend\.env" (
    echo [警告] backend\.env 不存在
    if exist "backend\.env.example" (
        echo [信息] 正在从 .env.example 创建 .env...
        copy "backend\.env.example" "backend\.env" >nul
        echo [成功] 已创建 backend\.env，请编辑配置后重新运行
        pause
        exit /b 0
    ) else (
        echo [错误] backend\.env.example 也不存在！
        pause
        exit /b 1
    )
) else (
    echo [成功] backend\.env 配置文件存在
)

REM 检查智能体配置
if not exist "config\agents.json" (
    echo [警告] config\agents.json 不存在
    if exist "config\agents.example.json" (
        echo [信息] 正在从 agents.example.json 创建 agents.json...
        copy "config\agents.example.json" "config\agents.json" >nul
        echo [成功] 已创建 config\agents.json
    ) else (
        echo [警告] config\agents.example.json 也不存在，跳过
    )
) else (
    echo [成功] config\agents.json 配置文件存在
)

echo.
echo [信息] 检查依赖安装状态...

set NEED_INSTALL=0

if not exist "node_modules" (
    echo [警告] 根目录 node_modules 不存在
    set NEED_INSTALL=1
)

if not exist "backend\node_modules" (
    echo [警告] backend\node_modules 不存在
    set NEED_INSTALL=1
)

if not exist "frontend\node_modules" (
    echo [警告] frontend\node_modules 不存在
    set NEED_INSTALL=1
)

if !NEED_INSTALL! equ 1 (
    echo [信息] 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败！
        pause
        exit /b 1
    )
    echo [成功] 依赖安装完成
) else (
    echo [成功] 所有依赖已安装
)

echo.
echo [信息] 启动前后端服务...
echo.
echo 后端服务将运行在: http://localhost:3001
echo 前端服务将运行在: http://localhost:3000
echo.
echo 按 Ctrl+C 停止所有服务
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM 检查 npm run dev 脚本是否存在
npm run 2>nul | findstr /C:"dev" >nul
if %errorlevel% neq 0 (
    echo [错误] 'npm run dev' 脚本不存在！
    echo [提示] 请检查 package.json 中是否配置了 dev 脚本
    pause
    exit /b 1
)

REM 启动服务
echo [信息] 正在执行: npm run dev
echo.
call npm run dev

REM 捕获退出代码
set EXIT_CODE=%errorlevel%

REM 如果服务停止
echo.
if %EXIT_CODE% neq 0 (
    echo [错误] 服务异常退出，退出代码: %EXIT_CODE%
    echo.
    echo [排查建议]:
    echo 1. 检查端口 3000 和 3001 是否被占用
    echo 2. 检查 backend/.env 配置是否正确
    echo 3. 查看上方错误信息
    echo 4. 尝试手动运行: npm run backend:dev 和 npm run frontend:dev
    echo.
) else (
    echo [信息] 服务已正常停止
)
pause
exit /b %EXIT_CODE%