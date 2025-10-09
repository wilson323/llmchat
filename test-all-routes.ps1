# 测试所有后端路由是否正常注册

$baseUrl = "http://localhost:3001"
$results = @()

Write-Host "`n🧪 开始测试所有后端路由..." -ForegroundColor Cyan

# 测试路由列表
$routes = @(
    @{ Method = "GET"; Path = "/health"; Name = "健康检查" }
    @{ Method = "GET"; Path = "/api/agents"; Name = "智能体列表" }
    @{ Method = "GET"; Path = "/api/admin/system-info"; Name = "系统信息" }
    @{ Method = "GET"; Path = "/api/audit"; Name = "审计日志" }
    @{ Method = "GET"; Path = "/api/dify"; Name = "Dify会话管理" }
    @{ Method = "GET"; Path = "/api/product-preview"; Name = "产品预览" }
    @{ Method = "GET"; Path = "/api/sessions"; Name = "会话管理" }
)

foreach ($route in $routes) {
    Write-Host "`n测试: $($route.Name)" -ForegroundColor Yellow
    Write-Host "  $($route.Method) $($route.Path)" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$($route.Path)" -Method $route.Method -ErrorAction Stop
        $status = $response.StatusCode
        $result = "✅ 成功 ($status)"
        $color = "Green"
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401) {
            $result = "🔒 需要认证 (401) - 路由存在"
            $color = "Yellow"
        } elseif ($status -eq 404) {
            $result = "❌ 路由不存在 (404)"
            $color = "Red"
        } else {
            $result = "⚠️ 其他错误 ($status)"
            $color = "Yellow"
        }
    }
    
    Write-Host "  $result" -ForegroundColor $color
    
    $results += @{
        Name = $route.Name
        Path = $route.Path
        Status = $status
        Result = $result
    }
}

# 输出总结
Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "📊 测试总结" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan

$success = ($results | Where-Object { $_.Status -in @(200, 401) }).Count
$total = $results.Count

Write-Host "`n✅ 成功/存在: $success/$total" -ForegroundColor Green

if ($success -eq $total) {
    Write-Host "`n🎉 所有路由都已正确注册！" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ 有些路由可能存在问题，请检查上面的详细信息" -ForegroundColor Yellow
}

Write-Host ""
