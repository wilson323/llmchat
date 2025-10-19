# 性能基准测试运行脚本（Windows PowerShell）
# 用于自动化执行性能测试

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  性能基准测试 - 日志优化后" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. 检查服务是否运行
Write-Host "🔍 检查后端服务..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ 后端服务运行正常" -ForegroundColor Green
} catch {
    Write-Host "❌ 后端服务未运行，请先启动: pnpm run backend:dev" -ForegroundColor Red
    exit 1
}

# 2. 运行基准测试
Write-Host "`n📊 运行基准测试..." -ForegroundColor Yellow
Write-Host "   测试项目: 健康检查(1000), Agents列表(500), 登录(100)" -ForegroundColor Gray
Write-Host ""

Push-Location -Path (Join-Path $PSScriptRoot "../..")
npx ts-node tests/performance/benchmark.ts
$benchmarkResult = $LASTEXITCODE
Pop-Location

if ($benchmarkResult -ne 0) {
    Write-Host "`n❌ 基准测试失败" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ 基准测试完成" -ForegroundColor Green

# 3. 询问是否运行压力测试
Write-Host "`n🤔 是否运行压力测试? (需要Artillery)" -ForegroundColor Yellow
Write-Host "   压力测试将持续4分钟，模拟10-100 req/s负载" -ForegroundColor Gray
$runStress = Read-Host "   继续? (Y/N)"

if ($runStress -eq "Y" -or $runStress -eq "y") {
    # 检查Artillery是否安装
    Write-Host "`n📦 检查Artillery..." -ForegroundColor Yellow
    $artilleryCheck = npx artillery -V 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   Artillery未安装，正在安装..." -ForegroundColor Gray
        pnpm add -D artillery
    } else {
        Write-Host "   ✅ Artillery已安装: $artilleryCheck" -ForegroundColor Green
    }
    
    # 运行压力测试
    Write-Host "`n🔥 运行压力测试..." -ForegroundColor Yellow
    Push-Location -Path (Join-Path $PSScriptRoot "../..")
    npx artillery run tests/performance/artillery.yml --output reports/artillery-report.json
    Pop-Location
    
    Write-Host "`n✅ 压力测试完成" -ForegroundColor Green
    Write-Host "   报告: reports/artillery-report.json" -ForegroundColor Gray
} else {
    Write-Host "`n⏭️  跳过压力测试" -ForegroundColor Gray
}

Write-Host "`n═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  性能测试完成！" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

