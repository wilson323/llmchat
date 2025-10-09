# 完整的用户界面和管理界面测试脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开始完整的界面测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 测试管理员登录
Write-Host "1️⃣ 测试管理员登录..." -ForegroundColor Yellow
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
    Write-Host "✅ 管理员登录成功" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ 管理员登录失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. 测试获取智能体列表
Write-Host "2️⃣ 测试获取智能体列表..." -ForegroundColor Yellow
try {
    $agentsResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/agents" `
        -Method GET `
        -Headers @{Authorization="Bearer $token"} `
        -UseBasicParsing
    
    $agents = ($agentsResponse.Content | ConvertFrom-Json).data
    Write-Host "✅ 获取智能体列表成功，共 $($agents.Count) 个智能体" -ForegroundColor Green
    foreach ($agent in $agents) {
        Write-Host "   - $($agent.name) ($($agent.id))" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ 获取智能体列表失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. 测试前端首页
Write-Host "3️⃣ 测试前端首页..." -ForegroundColor Yellow
try {
    $homeResponse = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
    if ($homeResponse.Content -match "LLMChat") {
        Write-Host "✅ 前端首页加载成功" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 前端首页内容异常" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 前端首页加载失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 4. 测试登录页面
Write-Host "4️⃣ 测试登录页面..." -ForegroundColor Yellow
try {
    $loginPageResponse = Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing
    if ($loginPageResponse.Content -match "LLMChat") {
        Write-Host "✅ 登录页面加载成功" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 登录页面内容异常" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 登录页面加载失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 5. 测试管理后台页面
Write-Host "5️⃣ 测试管理后台页面..." -ForegroundColor Yellow
try {
    $adminResponse = Invoke-WebRequest -Uri "http://localhost:3000/home" -UseBasicParsing
    if ($adminResponse.Content -match "LLMChat") {
        Write-Host "✅ 管理后台页面加载成功" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 管理后台页面内容异常" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 管理后台页面加载失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 6. 测试用户聊天页面
Write-Host "6️⃣ 测试用户聊天页面..." -ForegroundColor Yellow
try {
    $chatResponse = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing
    if ($chatResponse.Content -match "LLMChat") {
        Write-Host "✅ 用户聊天页面加载成功" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 用户聊天页面内容异常" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 用户聊天页面加载失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
