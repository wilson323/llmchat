@echo off
echo Creating backend/.env file...

(
echo MONGO_URI=mongodb://myusername:mypassword@171.43.138.237:27017/fastgpt?authSource=admin^&directConnection=true
echo MONGO_DB_NAME=fastgpt
echo.
echo # PostgreSQL数据库配置
echo DB_HOST=127.0.0.1
echo DB_PORT=5432
echo DB_USER=postgres
echo DB_PASSWORD=123456
echo DB_NAME=llmchat
echo DB_SSL=false
) > backend\.env

echo.
echo ✓ backend/.env file created successfully!
echo.
echo Configuration:
echo   Database: 127.0.0.1:5432
echo   User: postgres
echo   Password: 123456
echo   Database: llmchat
echo.
echo Next step: Restart the development server
echo   1. Press Ctrl+C to stop current server
echo   2. Run: pnpm dev
echo.
pause

