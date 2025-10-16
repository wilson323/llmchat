# 快速性能测试脚本
# 用于验证日志优化后的性能提升

$BASE_URL = "http://localhost:3001"

Write-Host "`n🚀 快速性能测试...`n" -ForegroundColor Green

try {
    # 测试1: 健康检查
    Write-Host "1️⃣ 测试健康检查端点..." -ForegroundColor Cyan
    $start1 = Get-Date
    $health = Invoke-WebRequest -Uri "$BASE_URL/health" -Method GET -UseBasicParsing
    $duration1 = ((Get-Date) - $start1).TotalMilliseconds
    Write-Host "   ✅ 响应: $([math]::Round($duration1, 2))ms (状态: $($health.StatusCode))`n" -ForegroundColor Green
    
    # 测试2: Agents列表
    Write-Host "2️⃣ 测试智能体列表..." -ForegroundColor Cyan
    $start2 = Get-Date
    $agents = Invoke-WebRequest -Uri "$BASE_URL/api/agents" -Method GET -UseBasicParsing
    $duration2 = ((Get-Date) - $start2).TotalMilliseconds
    $agentsData = $agents.Content | ConvertFrom-Json
    Write-Host "   ✅ 响应: $([math]::Round($duration2, 2))ms (数量: $($agentsData.Count))`n" -ForegroundColor Green
    
    # 测试3: 并发负载（10个请求）
    Write-Host "3️⃣ 快速负载测试（10个并发请求）..." -ForegroundColor Cyan
    $start3 = Get-Date
    
    $jobs = @()
    for ($i = 0; $i -lt 10; $i++) {
        $jobs += Start-Job -ScriptBlock {
            param($url)
            Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing | Out-Null
        } -ArgumentList "$BASE_URL/health"
    }
    
    $jobs | Wait-Job | Out-Null
    $jobs | Remove-Job
    
    $duration3 = ((Get-Date) - $start3).TotalMilliseconds
    $avgDuration = $duration3 / 10
    
    Write-Host "   ✅ 总时间: $([math]::Round($duration3, 2))ms, 平均: $([math]::Round($avgDuration, 2))ms`n" -ForegroundColor Green
    
    # 性能评估
    Write-Host "📊 性能评估:" -ForegroundColor Yellow
    $p95Target = 50
    
    $healthPass = $duration1 -lt $p95Target
    $agentsPass = $duration2 -lt $p95Target
    $loadPass = $avgDuration -lt $p95Target
    
    if ($healthPass) {
        Write-Host "   ✅ 健康检查: $([math]::Round($duration1, 2))ms < 50ms ✅" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 健康检查: $([math]::Round($duration1, 2))ms >= 50ms ⚠️" -ForegroundColor Red
    }
    
    if ($agentsPass) {
        Write-Host "   ✅ 智能体列表: $([math]::Round($duration2, 2))ms < 50ms ✅" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 智能体列表: $([math]::Round($duration2, 2))ms >= 50ms ⚠️" -ForegroundColor Red
    }
    
    if ($loadPass) {
        Write-Host "   ✅ 并发负载: $([math]::Round($avgDuration, 2))ms < 50ms ✅" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 并发负载: $([math]::Round($avgDuration, 2))ms >= 50ms ⚠️" -ForegroundColor Red
    }
    
    # 生成报告
    $report = @{
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        tests = @(
            @{
                name = "健康检查"
                duration = [math]::Round($duration1, 2)
                pass = $healthPass
            },
            @{
                name = "智能体列表"
                duration = [math]::Round($duration2, 2)
                pass = $agentsPass
            },
            @{
                name = "并发负载"
                duration = [math]::Round($avgDuration, 2)
                pass = $loadPass
            }
        )
        summary = @{
            allPass = $healthPass -and $agentsPass -and $loadPass
            avgResponseTime = [math]::Round(($duration1 + $duration2 + $avgDuration) / 3, 2)
        }
    }
    
    # 保存报告
    $reportDir = "reports"
    if (-not (Test-Path $reportDir)) {
        New-Item -ItemType Directory -Path $reportDir | Out-Null
    }
    
    $reportPath = "$reportDir/quick-perf-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
    
    Write-Host "`n📁 报告已保存: $reportPath" -ForegroundColor Cyan
    
    if ($report.summary.allPass) {
        Write-Host "`n✅ 所有测试通过！系统性能达标。`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n⚠️  部分测试未达标，请检查系统性能。`n" -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host "`n❌ 测试失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   请确保后端服务已启动: pnpm run backend:dev`n" -ForegroundColor Yellow
    exit 1
}

