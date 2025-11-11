# Windows 启动问题排查指南

如果你在 Windows 上运行启动脚本时遇到闪退或错误，请按照以下步骤排查。

## 🔍 问题诊断

### 步骤 1: 运行环境测试

```bash
test-env.bat
```

这个脚本会检查：
- ✓ Node.js 是否安装
- ✓ npm 是否可用
- ✓ 配置文件是否存在
- ✓ 依赖是否安装
- ✓ 端口是否被占用
- ✓ npm 脚本是否配置

### 步骤 2: 使用调试模式启动

如果环境测试有问题，运行调试脚本：

```bash
start-dev-debug.bat
```

这个脚本会：
- 显示详细的检查过程
- 自动安装缺失的依赖
- 提供详细的错误信息
- 给出具体的解决建议

## 🐛 常见问题和解决方案

### 问题 1: 脚本闪退，什么都没显示

**原因**: 可能是脚本执行太快，或者遇到了错误但窗口立即关闭

**解决方案**:
1. **右键点击脚本** → **编辑** → 在最后一行查看是否有 `pause`
2. **使用 CMD 手动运行**:
   ```bash
   # 打开 CMD
   cd /d F:\ss\aa\sssss\llmchat
   start-dev.bat
   ```
3. **查看错误信息**: 使用 `start-dev-debug.bat` 查看详细日志

---

### 问题 2: 提示 "concurrently 未安装"

**错误信息**:
```
Cannot find module 'concurrently'
```

**解决方案**:
```bash
# 方案 1: 使用调试脚本（推荐）
start-dev-debug.bat

# 方案 2: 手动安装
npm install

# 方案 3: 仅安装 concurrently
npm install concurrently --save-dev
```

---

### 问题 3: 提示 "端口被占用"

**错误信息**:
```
Error: listen EADDRINUSE: address already in use :::3001
或
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**:

**方法 1: 查找并关闭占用端口的程序**
```bash
# 查找占用 3001 端口的进程
netstat -ano | findstr :3001

# 查找占用 3000 端口的进程
netstat -ano | findstr :3000

# 输出示例:
# TCP  0.0.0.0:3001  0.0.0.0:0  LISTENING  12345
#                                           ^^^^^ 这是 PID

# 杀死进程（替换 12345 为实际 PID）
taskkill /PID 12345 /F
```

**方法 2: 修改端口**
```bash
# 编辑 backend/.env
PORT=3002  # 改为其他端口

# 编辑 frontend/vite.config.ts
# 修改 server.port 为 3001 或其他端口
```

---

### 问题 4: 提示 "backend\.env 不存在"

**错误信息**:
```
Cannot find module 'backend/.env'
```

**解决方案**:
```bash
# 方案 1: 使用脚本自动创建
start-dev-debug.bat

# 方案 2: 手动复制
copy backend\.env.example backend\.env

# 然后编辑 backend\.env 配置必需项
notepad backend\.env
```

**必需配置项**:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
AGENTS_CONFIG_PATH=../config/agents.json
LOG_LEVEL=debug
```

---

### 问题 5: 提示 "npm run dev 脚本不存在"

**错误信息**:
```
Missing script: "dev"
```

**解决方案**:

**检查 package.json**:
```bash
# 查看所有可用脚本
npm run

# 应该包含 dev 脚本
```

如果没有 `dev` 脚本，检查 `package.json` 中是否有：
```json
{
  "scripts": {
    "dev": "concurrently \"npm run backend:dev\" \"npm run frontend:dev\""
  }
}
```

---

### 问题 6: 依赖安装失败

**错误信息**:
```
npm ERR! code ENOENT
npm ERR! errno -4058
```

**解决方案**:
```bash
# 1. 清除 npm 缓存
npm cache clean --force

# 2. 删除所有 node_modules
rmdir /s /q node_modules
rmdir /s /q backend\node_modules
rmdir /s /q frontend\node_modules

# 3. 删除 package-lock.json
del package-lock.json
del backend\package-lock.json
del frontend\package-lock.json

# 4. 重新安装
npm install

# 5. 如果还是失败，尝试使用国内镜像
npm install --registry=https://registry.npmmirror.com
```

---

### 问题 7: 权限错误

**错误信息**:
```
Error: EPERM: operation not permitted
```

**解决方案**:
1. **以管理员身份运行 CMD**:
   - 右键 CMD → **以管理员身份运行**
   - 切换到项目目录
   - 运行启动脚本

2. **检查文件夹权限**:
   - 右键项目文件夹 → **属性** → **安全**
   - 确保当前用户有完全控制权限

3. **关闭杀毒软件**:
   - 临时关闭杀毒软件或防火墙
   - 将项目文件夹添加到白名单

---

### 问题 8: 中文乱码

**问题描述**: 控制台中文显示为乱码或问号

**解决方案**:

**方案 1: 修改 CMD 编码**
```bash
# 在 CMD 中执行
chcp 65001
```

**方案 2: 修改 CMD 字体**
- 右键 CMD 标题栏 → **属性** → **字体**
- 选择支持中文的字体（如 "新宋体"）

**方案 3: 使用 PowerShell**
```powershell
# PowerShell 默认支持 UTF-8
.\start-dev.bat
```

---

## 🛠️ 手动启动（不使用脚本）

如果所有脚本都无法运行，可以手动启动：

### 步骤 1: 安装依赖
```bash
npm install
```

### 步骤 2: 配置环境
```bash
copy backend\.env.example backend\.env
copy config\agents.example.json config\agents.json
notepad backend\.env
```

### 步骤 3: 分别启动前后端

**打开第一个 CMD 窗口（后端）**:
```bash
cd backend
npm run dev
```

**打开第二个 CMD 窗口（前端）**:
```bash
cd frontend
npm run dev
```

### 步骤 4: 访问应用
- 前端: http://localhost:3000
- 后端: http://localhost:3001

---

## 🔧 高级调试

### 启用详细日志

在 `backend/.env` 中设置:
```env
LOG_LEVEL=debug
NODE_DEBUG=*
```

### 查看 npm 详细日志

```bash
npm run dev --verbose
```

### 检查 Node.js 模块路径

```bash
node -e "console.log(process.env.NODE_PATH)"
node -e "console.log(require.resolve('concurrently'))"
```

---

## 📞 仍然无法解决？

如果尝试了所有方法仍然无法启动，请：

1. **收集信息**:
   ```bash
   # 运行并保存输出
   test-env.bat > error-log.txt
   start-dev-debug.bat >> error-log.txt
   ```

2. **检查系统信息**:
   ```bash
   systeminfo | findstr /C:"OS Name" /C:"OS Version"
   node -v
   npm -v
   ```

3. **创建 Issue**:
   - 访问: https://github.com/wilson323/llmchat/issues
   - 附上 `error-log.txt` 和系统信息
   - 描述详细的错误场景

---

## 💡 预防措施

1. **定期更新 Node.js**: 使用 Node.js 18 或更高版本
2. **使用稳定版 npm**: 建议 npm 9+
3. **避免路径包含中文**: 项目路径尽量使用英文
4. **定期清理依赖**: 每月运行一次 `npm install` 更新依赖
5. **使用 Git**: 通过 Git 管理代码，便于回滚问题版本

---

**祝你启动成功！🎉**