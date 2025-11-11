# Windows 启动脚本使用指南

本文档说明如何在 Windows 上使用各种启动脚本。

## 📁 可用的 Windows 脚本

| 脚本文件 | 用途 | 推荐场景 |
|---------|------|---------|
| `quick-start.bat` | ⚡ 快速启动 | 环境已配置好，快速启动 |
| `start-dev.bat` | 🚀 标准启动 | 日常开发使用 |
| `start-dev-debug.bat` | 🔍 调试启动 | 首次使用或遇到问题 |
| `test-env.bat` | 🧪 环境测试 | 检查环境是否正常 |

---

## 🚀 使用方法

### 方法 1: 双击运行（推荐）

直接在文件资源管理器中双击脚本文件即可。

### 方法 2: 使用 CMD

```bash
# 打开 CMD（Win+R 输入 cmd）
cd /d F:\ss\aa\sssss\llmchat

# 运行脚本
start-dev.bat
```

### 方法 3: 使用 PowerShell

```powershell
# 打开 PowerShell
cd F:\ss\aa\sssss\llmchat

# 运行脚本
.\start-dev.bat
```

---

## 📝 脚本详细说明

### 1. quick-start.bat - 快速启动 ⚡

**特点**:
- 最快速的启动方式
- 自动安装缺失的 concurrently
- 适合已配置好环境的用户

**使用**:
```bash
quick-start.bat
```

**输出示例**:
```
🚀 启动 LLMChat...

[0]
[0] > @llmchat/backend@1.0.0 dev
[0] > ts-node-dev --respawn ...
[1]
[1] > @llmchat/frontend@1.0.0 dev
[1] > vite
```

---

### 2. start-dev.bat - 标准启动 🚀

**特点**:
- 检查 Node.js 和 npm 版本
- 检查配置文件（自动创建缺失的）
- 检查依赖（自动安装缺失的）
- 显示友好的状态信息
- 提供详细的错误提示

**使用**:
```bash
start-dev.bat
```

**输出示例**:
```
╔══════════════════════════════════════════════╗
║     LLMChat 开发环境启动脚本                 ║
╚══════════════════════════════════════════════╝

当前目录: F:\ss\aa\sssss\llmchat

[成功] Node.js 版本:
v20.10.0
[成功] npm 版本:
10.2.3

[信息] 检查配置文件...
[成功] backend\.env 配置文件存在
[成功] config\agents.json 配置文件存在

[信息] 检查依赖安装状态...
[成功] 所有依赖已安装

[信息] 启动前后端服务...

后端服务将运行在: http://localhost:3001
前端服务将运行在: http://localhost:3000

按 Ctrl+C 停止所有服务
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[信息] 正在执行: npm run dev
```

---

### 3. start-dev-debug.bat - 调试启动 🔍

**特点**:
- 8 步详细检查过程
- 显示每一步的执行状态
- 自动修复常见问题
- 提供详细的错误诊断
- 适合首次使用或排查问题

**使用**:
```bash
start-dev-debug.bat
```

**输出示例**:
```
═══════════════════════════════════════════════════
  LLMChat 调试启动脚本
═══════════════════════════════════════════════════

[调试] 当前目录: F:\ss\aa\sssss\llmchat
[调试] 脚本路径: F:\ss\aa\sssss\llmchat\
[调试] 已切换到: F:\ss\aa\sssss\llmchat

[1/8] 检查 Node.js...
v20.10.0
[成功] Node.js 已安装

[2/8] 检查 npm...
10.2.3
[成功] npm 已安装

[3/8] 检查 package.json...
[成功] package.json 存在

[4/8] 检查后端配置...
[成功] backend\.env 已存在

[5/8] 检查智能体配置...
[成功] config\agents.json 已存在

[6/8] 检查依赖...
[成功] 根目录依赖已安装
[成功] 后端依赖已安装
[成功] 前端依赖已安装

[7/8] 检查 concurrently...
[成功] concurrently 已安装

[8/8] 检查 npm 脚本...
[成功] dev 脚本已配置

═══════════════════════════════════════════════════
  所有检查通过！准备启动服务...
═══════════════════════════════════════════════════
```

---

### 4. test-env.bat - 环境测试 🧪

**特点**:
- 快速检查环境状态
- 不执行任何修改
- 显示所有检查结果
- 提供修复建议

**使用**:
```bash
test-env.bat
```

**输出示例**:
```
════════════════════════════════════════
  LLMChat 环境测试
════════════════════════════════════════

[测试 1] 检查 Node.js
✓ Node.js:
v20.10.0

[测试 2] 检查 npm
✓ npm:
10.2.3

[测试 3] 检查项目文件
✓ package.json 存在
✓ backend\.env 存在
✓ config\agents.json 存在

[测试 4] 检查依赖
✓ 根目录 node_modules 存在
✓ 后端 node_modules 存在
✓ 前端 node_modules 存在
✓ concurrently 已安装

[测试 5] 检查端口占用
✓ 端口 3000 和 3001 可用

[测试 6] 检查 npm 脚本
✓ npm run dev 脚本已配置

════════════════════════════════════════
  测试完成！
════════════════════════════════════════

如果所有测试都显示 ✓，可以运行:
  start-dev.bat
```

---

## 🔧 首次使用流程

### 步骤 1: 测试环境
```bash
test-env.bat
```

查看所有检查项是否为 ✓

### 步骤 2: 使用调试模式启动
```bash
start-dev-debug.bat
```

这会自动修复环境问题

### 步骤 3: 配置环境变量

如果脚本提示需要配置 `.env`，编辑文件：
```bash
notepad backend\.env
```

配置必需项：
- `PORT=3001`
- `FRONTEND_URL=http://localhost:3000`
- 其他配置项

### 步骤 4: 再次启动

配置完成后，使用标准启动：
```bash
start-dev.bat
```

或快速启动：
```bash
quick-start.bat
```

---

## ❌ 遇到问题？

### 脚本闪退

**原因**: 脚本执行过程中遇到错误，但窗口立即关闭

**解决**:
```bash
# 方案 1: 使用调试脚本（推荐）
start-dev-debug.bat

# 方案 2: 使用 CMD 手动运行
# 打开 CMD
cd /d F:\ss\aa\sssss\llmchat
start-dev.bat
# 这样可以看到错误信息

# 方案 3: 查看详细错误
start-dev-debug.bat > error.log 2>&1
# 然后查看 error.log 文件
```

### 提示 "concurrently 未安装"

```bash
# 方案 1: 让脚本自动安装
quick-start.bat  # 会自动安装

# 方案 2: 手动安装
npm install

# 方案 3: 仅安装 concurrently
npm install concurrently --save-dev
```

### 端口被占用

```bash
# 查找占用端口的进程
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# 杀死进程（替换 PID）
taskkill /PID <PID> /F
```

### 更多问题

查看详细的故障排查指南：
```bash
# 打开故障排查文档
TROUBLESHOOTING-WINDOWS.md
```

---

## 💡 使用技巧

### 技巧 1: 创建桌面快捷方式

1. 右键脚本文件 → **发送到** → **桌面快捷方式**
2. 双击快捷方式即可启动

### 技巧 2: 以管理员身份运行

如果遇到权限问题：
1. 右键脚本 → **以管理员身份运行**

### 技巧 3: 查看实时日志

启动后，控制台会显示前后端的实时日志：
- `[0]` 开头的是后端日志
- `[1]` 开头的是前端日志

### 技巧 4: 优雅停止服务

在控制台按 `Ctrl+C`，然后：
- 选择 `Y` 确认终止批处理
- 或按两次 `Ctrl+C` 强制停止

### 技巧 5: 修改配置后重启

修改 `backend/.env` 后：
- 按 `Ctrl+C` 停止服务
- 重新运行启动脚本

修改 `agents.json` 后：
- 无需重启，调用 API 热重载：
  ```bash
  curl -X POST http://localhost:3001/api/agents/reload
  ```

---

## 🎯 脚本选择建议

| 场景 | 推荐脚本 | 原因 |
|------|---------|------|
| 首次使用 | `start-dev-debug.bat` | 会检查和修复所有问题 |
| 日常开发 | `quick-start.bat` | 最快速的启动 |
| 遇到问题 | `test-env.bat` → `start-dev-debug.bat` | 先测试再调试 |
| 团队协作 | `start-dev.bat` | 标准化的启动流程 |
| 生产部署 | 使用 `npm run build` + `npm start` | 不使用开发脚本 |

---

## 📚 相关文档

- [完整启动指南](START.md) - 跨平台启动说明
- [Windows 故障排查](TROUBLESHOOTING-WINDOWS.md) - 详细问题解决
- [项目文档](CLAUDE.md) - 开发指南
- [README](README.md) - 项目说明

---

**祝你使用愉快！🎉**