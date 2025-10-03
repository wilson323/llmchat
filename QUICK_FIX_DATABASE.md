# 数据库连接快速修复指南

## 🔧 问题
- 后端报错: `DB_NOT_INITIALIZED`
- 环境变量未加载

## ✅ 解决步骤

### 1. 确认 `backend/.env` 文件内容

请确保 `backend/.env` 文件包含以下内容：

```env
MONGO_URI=mongodb://myusername:mypassword@171.43.138.237:27017/fastgpt?authSource=admin&directConnection=true
MONGO_DB_NAME=fastgpt

# PostgreSQL数据库配置
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=123456
DB_NAME=llmchat
DB_SSL=false
```

### 2. 确保PostgreSQL数据库已启动

#### 选项A: 使用本地PostgreSQL
```bash
# 检查PostgreSQL是否运行
# Windows: 打开服务管理器，查看 postgresql-x64-15 服务
# 或使用命令行
psql -U postgres -h 127.0.0.1 -p 5432 -c "SELECT version();"
```

#### 选项B: 使用Docker（推荐）
```bash
# 启动PostgreSQL容器
docker-compose -f docker-compose.dev.yml up -d

# 检查状态
docker-compose -f docker-compose.dev.yml ps
```

### 3. 重启开发服务器

**重要**: 修改 `.env` 文件后必须重启服务器！

1. **停止当前服务器**: 在运行 `pnpm dev` 的终端按 `Ctrl+C`
2. **重新启动**: 
   ```bash
   pnpm dev
   ```

### 4. 验证启动成功

启动后应该看到：
```
[info]: 数据库连接成功
[info]: Server running on port 3001
```

**不应该再看到**:
- ❌ `Environment variable DB_HOST not set`
- ❌ `DB_NOT_INITIALIZED`
- ❌ `Failed to parse configuration`

## 🐛 故障排查

### 问题1: 环境变量仍未加载
```bash
# 1. 检查.env文件是否存在
dir backend\.env

# 2. 查看文件内容
type backend\.env

# 3. 确保文件编码为UTF-8
```

### 问题2: 数据库连接失败
```bash
# 测试数据库连接
psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "\l"
# 输入密码: 123456
```

### 问题3: 端口被占用
```bash
# 检查5432端口
netstat -ano | findstr :5432

# 如果被占用，修改backend/.env中的DB_PORT
```

## 📝 验证清单

- [ ] `backend/.env` 文件存在且包含所有配置
- [ ] PostgreSQL在127.0.0.1:5432运行
- [ ] 密码为123456
- [ ] 数据库名为llmchat
- [ ] 已重启开发服务器
- [ ] 后端成功启动，无DB错误

## 🎯 下一步

启动成功后：
1. 访问 http://localhost:3000
2. 开始 **Phase 1 验证** （见 `docs/全局项目审计与优化方案/PHASE1_VERIFICATION_GUIDE.md`）
3. 测试优化效果

---

**提示**: 如果使用Docker，后续开发都可以用 `docker-compose -f docker-compose.dev.yml up -d` 快速启动数据库。

