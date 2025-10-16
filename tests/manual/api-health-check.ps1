# API端点健康检查脚本
# 验证所有核心API端点是否正常响应

$BASE_URL = "http://localhost:3001"
$results = @()

Write-Host "`n🔍 API端点健康检查开始...`n" -ForegroundColor Green

# 测试函数
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Description
    )
    
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL$Path" -Method $Method -UseBasicParsing -ErrorAction Stop
        $status = "✅"
        $statusCode = $response.StatusCode
        $color = "Green"
    } catch {
        $status = if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) { "🔒" } else { "❌" }
        $statusCode = $_.Exception.Response.StatusCode
        $color = if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) { "Yellow" } else { "Red" }
    }
    
    $result = [PSCustomObject]@{
        Status = $status
        Method = $Method
        Path = $Path
        StatusCode = $statusCode
        Description = $Description
    }
    
    Write-Host "$status [$Method] $Path - $statusCode ($Description)" -ForegroundColor $color
    return $result
}

# 核心端点测试
Write-Host "📊 核心端点:" -ForegroundColor Cyan
$results += Test-Endpoint -Method "GET" -Path "/health" -Description "健康检查"
$results += Test-Endpoint -Method "GET" -Path "/api/agents" -Description "智能体列表"
$results += Test-Endpoint -Method "GET" -Path "/api/csrf-token" -Description "CSRF Token"

Write-Host "`n🔐 认证端点:" -ForegroundColor Cyan
$results += Test-Endpoint -Method "POST" -Path "/api/auth/login" -Description "用户登录"
$results += Test-Endpoint -Method "POST" -Path "/api/auth/refresh" -Description "刷新Token"

Write-Host "`n💬 聊天端点:" -ForegroundColor Cyan
$results += Test-Endpoint -Method "POST" -Path "/api/chat/completions" -Description "聊天完成"
$results += Test-Endpoint -Method "GET" -Path "/api/sessions" -Description "会话列表"

Write-Host "`n⚙️ 管理端点 (需要认证):" -ForegroundColor Cyan
$results += Test-Endpoint -Method "GET" -Path "/api/admin/stats" -Description "统计信息"
$results += Test-Endpoint -Method "GET" -Path "/api/admin/metrics" -Description "系统指标"
$results += Test-Endpoint -Method "GET" -Path "/api/database/performance" -Description "数据库性能"
$results += Test-Endpoint -Method "GET" -Path "/api/queue/status" -Description "队列状态"
$results += Test-Endpoint -Method "GET" -Path "/api/visualization/config" -Description "可视化配置"

Write-Host "`n🎨 功能端点:" -ForegroundColor Cyan
$results += Test-Endpoint -Method "GET" -Path "/api/cad/status" -Description "CAD服务状态"
$results += Test-Endpoint -Method "GET" -Path "/api/product-preview/status" -Description "产品预览状态"

# 统计
$total = $results.Count
$success = ($results | Where-Object { $_.Status -eq "✅" }).Count
$authRequired = ($results | Where-Object { $_.Status -eq "🔒" }).Count
$failed = ($results | Where-Object { $_.Status -eq "❌" }).Count

Write-Host "`n📊 测试结果统计:" -ForegroundColor Yellow
Write-Host "   总端点数: $total"
Write-Host "   ✅ 正常响应: $success" -ForegroundColor Green
Write-Host "   🔒 需要认证: $authRequired" -ForegroundColor Yellow
Write-Host "   ❌ 失败: $failed" -ForegroundColor Red

# 判断整体健康状态
$healthScore = [math]::Round((($success + $authRequired) / $total) * 100, 2)
Write-Host "`n🎯 整体健康度: $healthScore%" -ForegroundColor $(if ($healthScore -ge 80) { "Green" } elseif ($healthScore -ge 60) { "Yellow" } else { "Red" })

if ($healthScore -ge 90) {
    Write-Host "`n✅ 系统健康状态优秀！" -ForegroundColor Green
} elseif ($healthScore -ge 70) {
    Write-Host "`n⚠️  系统基本健康，部分端点需要关注。" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ 系统存在问题，请检查后端服务。" -ForegroundColor Red
}

Write-Host ""

