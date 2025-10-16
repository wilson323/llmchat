# ===================================
# LLMChat 核心功能手动验证测试
# ===================================
# 创建时间: 2025-10-16
# 用途: 快速验证系统核心功能可用性
# ===================================

Write-Host "🚀 开始LLMChat核心功能验证测试..." -ForegroundColor Cyan
Write-Host ""

# 等待后端服务启动
Write-Host "⏳ 等待后端服务启动（5秒）..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 定义API基础URL
$baseUrl = "http://localhost:3001"
$token = ""

# ===================================
# 测试1: 健康检查
# ===================================
Write-Host "📋 测试1: 健康检查" -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    if ($response) {
        Write-Host "  ✅ 健康检查通过" -ForegroundColor Green
        Write-Host "  响应: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ❌ 健康检查失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ===================================
# 测试2: 用户登录
# ===================================
Write-Host "📋 测试2: 用户登录（admin/admin123）" -ForegroundColor Green
try {
    $loginBody = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json"
    
    $token = $loginResponse.data.token
    $user = $loginResponse.data.user
    
    Write-Host "  ✅ 登录成功" -ForegroundColor Green
    Write-Host "  用户名: $($user.username)" -ForegroundColor Gray
    Write-Host "  角色: $($user.role)" -ForegroundColor Gray
    Write-Host "  Token长度: $($token.Length) 字符" -ForegroundColor Gray
    Write-Host "  Token前20字符: $($token.Substring(0, [Math]::Min(20, $token.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "  ❌ 登录失败: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "  详情: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# ===================================
# 测试3: 获取智能体列表
# ===================================
Write-Host "📋 测试3: 获取智能体列表" -ForegroundColor Green
try {
    $agentsResponse = Invoke-RestMethod -Uri "$baseUrl/api/agents" -Method Get
    
    if ($agentsResponse.agents) {
        $agentCount = $agentsResponse.agents.Count
        Write-Host "  ✅ 获取成功，共 $agentCount 个智能体" -ForegroundColor Green
        
        foreach ($agent in $agentsResponse.agents) {
            Write-Host "  - [$($agent.id)] $($agent.name)" -ForegroundColor Gray
            Write-Host "    Provider: $($agent.provider), 状态: $(if($agent.isActive){'激活'}else{'未激活'})" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  ⚠️ 智能体列表为空" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ 获取智能体列表失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ===================================
# 测试4: 管理员系统信息（需要Token）
# ===================================
if ($token) {
    Write-Host "📋 测试4: 管理员系统信息（需要认证）" -ForegroundColor Green
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        
        $sysInfoResponse = Invoke-RestMethod -Uri "$baseUrl/api/admin/system-info" `
            -Method Get `
            -Headers $headers
        
        Write-Host "  ✅ 系统信息获取成功" -ForegroundColor Green
        Write-Host "  服务器时间: $($sysInfoResponse.data.serverTime)" -ForegroundColor Gray
        Write-Host "  运行时长: $($sysInfoResponse.data.uptime) 秒" -ForegroundColor Gray
        
        if ($sysInfoResponse.data.systemInfo) {
            $sys = $sysInfoResponse.data.systemInfo
            Write-Host "  CPU使用率: $($sys.cpuUsage)%" -ForegroundColor Gray
            Write-Host "  内存使用: $($sys.memoryUsage.usedMemoryMB)MB / $($sys.memoryUsage.totalMemoryMB)MB" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ❌ 系统信息获取失败: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "  详情: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "📋 测试4: 管理员系统信息 - 跳过（未获取到Token）" -ForegroundColor Yellow
}
Write-Host ""

# ===================================
# 测试5: 聊天初始化（不需要Token）
# ===================================
Write-Host "📋 测试5: 聊天初始化" -ForegroundColor Green
try {
    # 获取第一个智能体ID用于测试
    $agentsResp = Invoke-RestMethod -Uri "$baseUrl/api/agents" -Method Get
    if ($agentsResp.agents -and $agentsResp.agents.Count -gt 0) {
        $firstAgentId = $agentsResp.agents[0].id
        
        $initResponse = Invoke-RestMethod -Uri "$baseUrl/api/chat/init?appId=$firstAgentId&stream=false" `
            -Method Get
        
        Write-Host "  ✅ 初始化成功" -ForegroundColor Green
        Write-Host "  智能体: $firstAgentId" -ForegroundColor Gray
        if ($initResponse.welcomeText) {
            Write-Host "  欢迎语: $($initResponse.welcomeText.Substring(0, [Math]::Min(50, $initResponse.welcomeText.Length)))..." -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ 没有可用的智能体" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ 初始化失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ===================================
# 测试总结
# ===================================
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 测试结果总结：" -ForegroundColor Yellow
Write-Host "  - 健康检查: $(if($response){'✅ 通过'}else{'❌ 失败'})"
Write-Host "  - 用户登录: $(if($token){'✅ 通过'}else{'❌ 失败'})"
Write-Host "  - 智能体列表: ✅ 查看上方输出"
Write-Host "  - 管理员接口: $(if($token){'✅ 查看上方输出'}else{'❌ 跳过'})"
Write-Host "  - 聊天初始化: ✅ 查看上方输出"
Write-Host ""
Write-Host "💡 下一步建议：" -ForegroundColor Yellow
Write-Host "  1. 检查后端服务日志（backend/log/）"
Write-Host "  2. 使用浏览器访问 http://localhost:3000 进行前端测试"
Write-Host "  3. 查看 TASK_LIST.md 了解待完成任务"
Write-Host ""

