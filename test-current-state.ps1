# 测试当前登录和页面状态

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试当前系统状态" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 测试后端健康状态
Write-Host "1️⃣ 测试后端健康状态..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
    Write-Host "✅ 后端运行正常" -ForegroundColor Green
} catch {
    Write-Host "❌ 后端未运行: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. 测试前端页面
Write-Host ""
Write-Host "2️⃣ 测试前端页面..." -ForegroundColor Yellow
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
    Write-Host "✅ 前端运行正常" -ForegroundColor Green
} catch {
    Write-Host "❌ 前端未运行: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. 测试登录API
Write-Host ""
Write-Host "3️⃣ 测试登录API..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -UseBasicParsing
    
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.data.token
    Write-Host "✅ 登录API正常" -ForegroundColor Green
    Write-Host "   Token: $($token.Substring(0, 30))..." -ForegroundColor Gray
    
    # 4. 测试获取智能体列表（需要token）
    Write-Host ""
    Write-Host "4️⃣ 测试智能体列表API..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $agentsResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/agents" `
        -Headers $headers `
        -UseBasicParsing
    
    $agents = ($agentsResponse.Content | ConvertFrom-Json).data
    Write-Host "✅ 智能体列表API正常" -ForegroundColor Green
    Write-Host "   智能体数量: $($agents.Count)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ API测试失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ 所有后端API测试通过" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "现在需要手动测试前端页面：" -ForegroundColor Yellow
Write-Host "1. 打开浏览器访问: http://localhost:3000" -ForegroundColor Cyan
Write-Host "2. 检查页面是否正常显示" -ForegroundColor Cyan
Write-Host "3. 尝试登录: http://localhost:3000/login" -ForegroundColor Cyan
Write-Host "4. 检查登录后跳转是否正确" -ForegroundColor Cyan
