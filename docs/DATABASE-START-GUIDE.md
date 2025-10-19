# PostgreSQL数据库启动指南

## 🚨 当前问题

后端服务启动失败，原因：**PostgreSQL数据库服务未运行**

```
错误: ECONNREFUSED
配置: localhost:5432
服务状态: Stopped (已停止)
```

---

## ✅ 解决方案1：启动本地PostgreSQL（推荐）

### Windows管理员PowerShell

1. **以管理员身份打开PowerShell**
   - 右键点击PowerShell图标
   - 选择"以管理员身份运行"

2. **启动PostgreSQL服务**
   ```powershell
   Start-Service -Name "postgresql-x64-15"
   ```

3. **验证服务状态**
   ```powershell
   Get-Service -Name "postgresql-x64-15"
   # 应该显示: Status = Running
   ```

4. **返回项目目录，重新启动后端**
   ```powershell
   cd F:\ss\aa\sssss\llmchat
   pnpm run backend:dev
   ```

### 或使用Services图形界面

1. 按 `Win + R`，输入 `services.msc`
2. 找到 "postgresql-x64-15"
3. 右键点击，选择"启动"
4. 等待状态变为"正在运行"

---

## ✅ 解决方案2：使用远程数据库

如果本地PostgreSQL有问题，可以使用远程数据库。

### 编辑 `backend/.env`
```env
# 远程数据库配置（示例）
DB_HOST=171.43.138.237
DB_PORT=5443
DB_USER=username
DB_NAME=postgres
DB_PASSWORD=postgres
```

### 重启后端服务
```bash
pnpm run backend:dev
```

---

## ✅ 解决方案3：临时测试方案（仅E2E测试）

如果只是为了运行E2E测试，而之前的后端服务仍在某个窗口运行：

### 查找后端进程
```powershell
Get-Process -Name node | Where-Object { $_.MainWindowTitle -like "*backend*" }
```

### 或直接测试3001端口
```powershell
# 测试健康检查
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

如果返回正常响应，说明后端已在运行，可以直接执行E2E测试。

---

## 🎯 快速启动PostgreSQL

### 命令行方式（需管理员）
```powershell
# 启动
Start-Service postgresql-x64-15

# 停止
Stop-Service postgresql-x64-15

# 重启
Restart-Service postgresql-x64-15

# 设置自动启动
Set-Service -Name postgresql-x64-15 -StartupType Automatic
```

### 验证连接
```powershell
# 使用psql测试连接
psql -h localhost -p 5432 -U postgres -d postgres
# 输入密码: 123456
# 成功后会看到postgres=#提示符
```

---

## 📋 完整启动流程（推荐）

### 1. 启动PostgreSQL（管理员PowerShell）
```powershell
Start-Service postgresql-x64-15
Get-Service postgresql-x64-15  # 验证Status=Running
```

### 2. 启动后端服务（项目目录）
```powershell
cd F:\ss\aa\sssss\llmchat
pnpm run backend:dev
# 等待看到: 🚀 服务器启动成功
```

### 3. 运行E2E测试
```powershell
pnpm run test:e2e
# 预期: 75+/111通过 (68%+)
```

---

## 🆘 常见问题

### Q1: Start-Service权限不足
**A**: 必须以管理员身份运行PowerShell

### Q2: PostgreSQL服务不存在
**A**: 
- 检查PostgreSQL是否已安装
- 运行 `Get-Service -Name "postgresql*"` 查看服务名
- 可能需要重新安装PostgreSQL

### Q3: 连接仍然失败（服务已运行）
**A**:
- 检查PostgreSQL配置文件（pg_hba.conf）
- 确认监听地址（postgresql.conf的listen_addresses）
- 检查防火墙规则

### Q4: 不想用本地数据库
**A**: 使用方案2，配置远程数据库

---

## ⚡ 当前状态

```
PostgreSQL服务: ❌ Stopped (需启动)
后端服务: ❌ 未运行（等待数据库）
E2E测试: ⏸️ 待执行（需后端运行）
```

---

**建议操作**: 以管理员身份启动PostgreSQL服务，然后重新运行后端服务。

