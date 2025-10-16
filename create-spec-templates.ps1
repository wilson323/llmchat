# 规格工作流模板生成脚本
# 用法: .\create-spec-templates.ps1

Write-Host "正在创建规格工作流模板..." -ForegroundColor Cyan

# 确保目录存在
$templateDir = ".claude\specs\_templates"
if (-not (Test-Path $templateDir)) {
    New-Item -ItemType Directory -Path $templateDir -Force | Out-Null
}

Write-Host " 创建模板目录: $templateDir" -ForegroundColor Green

# 创建文件列表
$files = @(
    "spec.md",
    "plan.md",
    "tasks.md",
    "status.json",
    "README.md"
)

Write-Host "`n创建的模板文件:" -ForegroundColor Yellow
foreach ($file in $files) {
    Write-Host "  - $file" -ForegroundColor Gray
}

Write-Host "`n模板将在下一步创建..." -ForegroundColor Cyan
Write-Host "请运行以下命令来创建各个模板文件:" -ForegroundColor Yellow
Write-Host '  Get-Content create-spec-content.ps1 | PowerShell -NoProfile' -ForegroundColor White

