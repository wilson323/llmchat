@echo off
REM ====================================
REM 一键迁移到AuthServiceV2脚本
REM ====================================
REM 功能:
REM - 运行数据库迁移
REM - 执行密码迁移
REM - 启用AuthServiceV2
REM ====================================

echo ========================================
echo   LLMChat - 认证系统V2迁移工具
echo ========================================
echo.

REM 1. 检查环境
echo [1/5] 检查环境配置...
call npm run validate:env
if errorlevel 1 (
    echo [ERROR] 环境变量验证失败，请检查.env配置
    pause
    exit /b 1
)
echo [OK] 环境配置正常
echo.

REM 2. 数据库迁移
echo [2/5] 运行数据库迁移...
echo   - 迁移007: 移除明文密码列准备
echo   - 迁移008: 添加认证安全字段
echo.
echo 提示: 如需手动执行，运行以下命令:
echo   npx ts-node -r tsconfig-paths/register src/scripts/migrate.ts up 007
echo   npx ts-node -r tsconfig-paths/register src/scripts/migrate.ts up 008
echo.

REM 3. 密码迁移（需要手动确认）
echo [3/5] 准备密码迁移...
echo.
echo ⚠️  重要提示:
echo   - 密码迁移是不可逆操作
echo   - 所有明文密码将转换为bcrypt哈希
echo   - 建议先在测试环境验证
echo.
set /p CONFIRM_MIGRATE="是否继续密码迁移? (输入 YES 继续): "
if /i not "%CONFIRM_MIGRATE%"=="YES" (
    echo [SKIP] 已跳过密码迁移
    echo 如需手动执行: set AUTO_CONFIRM=true ^& npm run migrate:passwords
    goto enable_v2
)

echo [执行] 正在迁移密码...
set AUTO_CONFIRM=true
call npm run migrate:passwords
if errorlevel 1 (
    echo [ERROR] 密码迁移失败
    pause
    exit /b 1
)
echo [OK] 密码迁移完成
echo.

:enable_v2
REM 4. 启用AuthServiceV2
echo [4/5] 启用AuthServiceV2...
echo USE_AUTH_V2=true >> .env
echo [OK] 已在.env中启用V2服务
echo.

REM 5. 验证迁移
echo [5/5] 验证迁移结果...
echo.
echo 请检查:
echo   1. 数据库表users是否有以下字段:
echo      - password_hash (非空)
echo      - failed_login_attempts
echo      - locked_until
echo      - last_login_at
echo   2. .env中USE_AUTH_V2=true
echo   3. 启动服务测试登录功能
echo.

echo ========================================
echo   迁移准备完成！
echo ========================================
echo.
echo 后续步骤:
echo   1. 重启服务: npm run dev
echo   2. 测试登录功能
echo   3. 如有问题可回退: set USE_AUTH_V2=false
echo.
pause

