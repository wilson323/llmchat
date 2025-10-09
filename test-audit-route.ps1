# 测试审计路由是否正常工作

$baseUrl = "http://localhost:3001"

Write-Host "`n🧪 测试审计路由..." -ForegroundColor Cyan

# 测试1: 无认证访问
Write-Host "`n测试1: 无认证访问 /api/audit/recent" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/audit/recent" -Method GET -ErrorAction Stop
    Write-Host "  ✅ 成功: $($response.StatusCode)" -ForegroundColor Green
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401) {
        Write-Host "  🔒 需要认证 (401) - 路由存在且正常工作！" -ForegroundColor Green
    } elseif ($status -eq 404) {
        Write-Host "  ❌ 路由不存在 (404)" -ForegroundColor Red
    } else {
        Write-Host "  ⚠️ 其他错误 ($status)" -ForegroundColor Yellow
    }
}

# 测试2: 使用假token访问
Write-Host "`n测试2: 使用假token访问 /api/audit/recent" -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer fake-token" }
    $response = Invoke-WebRequest -Uri "$baseUrl/api/audit/recent" -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "  ✅ 成功: $($response.StatusCode)" -ForegroundColor Green
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401) {
        Write-Host "  🔒 Token无效 (401) - 路由存在且认证正常工作！" -ForegroundColor Green
    } elseif ($status -eq 404) {
        Write-Host "  ❌ 路由不存在 (404)" -ForegroundColor Red
    } else {
        Write-Host "  ⚠️ 其他错误 ($status)" -ForegroundColor Yellow
    }
}

# 测试3: 测试其他审计路由
$auditRoutes = @(
    "/api/audit/logs",
    "/api/audit/recent",
    "/api/audit/failures",
    "/api/audit/statistics"
)

Write-Host "`n测试3: 测试所有审计路由端点" -ForegroundColor Yellow
foreach ($route in $auditRoutes) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$route" -Method GET -ErrorAction Stop
        Write-Host "  ✅ $route - 成功 ($($response.StatusCode))" -ForegroundColor Green
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401) {
            Write-Host "  🔒 $route - 需要认证 (401) ✓" -ForegroundColor Green
        } elseif ($status -eq 404) {
            Write-Host "  ❌ $route - 不存在 (404)" -ForegroundColor Red
        } else {
            Write-Host "  ⚠️ $route - 错误 ($status)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n✅ 测试完成！" -ForegroundColor Cyan
Write-Host "如果所有路由都返回401，说明路由注册成功，只是需要认证。" -ForegroundColor Gray
