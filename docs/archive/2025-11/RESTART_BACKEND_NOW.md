# ⚠️ 紧急：必须重启后端服务

## 🔴 当前状况

**问题**：旧的后端代码还在运行（没有路由的残缺版本）  
**端口**：3005已被旧进程占用  
**结果**：前端请求返回404（因为旧代码没有注册路由）  

## 🔧 解决方案：重启后端

### 方法1：停止旧进程并重启（推荐）

**步骤1：找到后端进程**
```powershell
Get-NetTCPConnection -LocalPort 3005 | Select-Object OwningProcess
```

**步骤2：停止旧进程**
```powershell
# 替换PID为上面查到的进程ID
Stop-Process -Id PID号 -Force
```

**步骤3：配置数据库密码**
```powershell
# 用记事本打开.env
notepad .env

# 修改第40行：
DB_PASSWORD=实际的数据库密码
```

**步骤4：生成并配置JWT密钥**
```powershell
# 生成密钥
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# 复制输出的密钥，修改.env第90行：
JWT_SECRET=粘贴刚才生成的密钥
```

**步骤5：启动新后端**
```powershell
# 在项目根目录
pnpm run backend:dev
```

### 方法2：快速重启（如果不需要配置）

如果数据库密码和JWT密钥已配置，直接：

```powershell
# 停止所有node进程（谨慎！）
Get-Process node | Stop-Process -Force

# 重启后端
pnpm run backend:dev
```

## ✅ 验证成功

启动后，检查：

1. **终端输出包含**：
```
✅ 数据库连接成功
✅ 智能体配置服务已就绪
✅ 核心路由已全部注册  ← 这行很重要！
🚀 服务器启动成功
```

2. **测试健康检查**：
```powershell
Invoke-WebRequest http://localhost:3005/health
```

3. **测试登录API**：
```powershell
Invoke-WebRequest -Method POST -Uri http://localhost:3005/api/auth/login `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"username":"admin","password":"123456"}' | 
  Select-Object StatusCode
```

应该返回 `StatusCode: 200` 或 `StatusCode: 400`（参数验证），**不是404**！

## 🎯 预期效果

重启后，前端登录时：
- ❌ 不再显示：`POST http://127.0.0.1:3004/api/auth/login 404 (Not Found)`
- ✅ 应该显示：正常的登录响应或验证错误

---

**紧急程度**：🔴 高  
**操作时间**：< 5分钟  
**下一步**：立即按照本文档重启后端

