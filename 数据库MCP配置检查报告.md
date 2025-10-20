# 数据库MCP配置检查报告

**检查时间**: 2025-10-20  
**检查对象**: LLMChat项目数据库配置与MCP集成

---

## 📋 检查摘要

### ✅ 正常配置
- `.env`文件存在且可读
- 数据库环境变量已配置
- 代码层面的数据库连接逻辑正常

### ⚠️ 发现的问题

#### 1. 【高优先级】MCP未配置数据库服务器

**问题描述**:
- `.cursor/mcp.json` 和 `.mcp.json` 中**只配置了task-master-ai和playwright**
- **缺少PostgreSQL数据库的MCP服务器配置**
- Cursor无法通过MCP直接访问和管理数据库

**当前MCP配置**:
```json
{
  "mcpServers": {
    "task-master-ai": { ... },
    "playwright": { ... }
    // ❌ 缺少数据库MCP配置
  }
}
```

**影响**:
- 无法在Cursor中直接查询数据库
- 无法使用MCP工具管理数据库表结构
- 需要手动连接数据库进行操作

---

#### 2. 【中优先级】数据库密码疑似占位符

**当前配置**:
```env
DB_HOST=171.43.138.237
DB_PORT=5443
DB_USER=username
DB_PASSWORD=postgres        # ⚠️ 疑似占位符值
DB_NAME=llmchat
```

**问题**:
- `DB_PASSWORD=postgres` 看起来像是示例值
- `DB_USER=username` 也是常见的占位符
- 如果是真实值，安全性较低

**建议**:
1. 确认这是否为真实的数据库凭据
2. 如果是占位符，请更新为实际值
3. 如果是真实值，建议修改为更强的密码

---

#### 3. 【低优先级】非标准端口配置

**配置详情**:
```env
DB_PORT=5443          # 标准PostgreSQL端口是5432
REDIS_PORT=7788       # 标准Redis端口是6379
```

**说明**:
- 非标准端口通常用于安全考虑或多实例部署
- 配置本身没有问题，但需要确认：
  - 防火墙规则是否允许这些端口
  - 服务是否确实在这些端口监听

---

## 🔧 详细配置信息

### 数据库配置
```
服务器地址: 171.43.138.237
端口: 5443
数据库名: llmchat
用户名: username
SSL: false (未启用)
连接池: 最小5，最大30
```

### Redis配置
```
服务器地址: 171.43.138.237
端口: 7788
数据库: 0
密码: (空)
```

### 测试环境配置
- 与生产环境使用相同的服务器和端口
- 数据库名相同: llmchat
- ⚠️ 建议使用独立的测试数据库

---

## 🎯 建议修复方案

### 方案1: 添加PostgreSQL MCP服务器（推荐）

**步骤1**: 安装PostgreSQL MCP服务器
```bash
npm install -g @modelcontextprotocol/server-postgres
```

**步骤2**: 更新 `.mcp.json` 配置
```json
{
  "mcpServers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://username:postgres@171.43.138.237:5443/llmchat"],
      "env": {
        "PGCONNECTIONSTRING": "postgresql://username:postgres@171.43.138.237:5443/llmchat"
      }
    },
    "task-master-ai": { ... },
    "playwright": { ... }
  }
}
```

**步骤3**: 重启Cursor使配置生效

**效果**:
- ✅ 可以在Cursor中直接查询数据库
- ✅ 支持schema管理和数据导出
- ✅ 提供SQL自动补全和验证

---

### 方案2: 验证数据库凭据

**测试连接**:
```bash
# 在项目根目录执行
cd backend
npm run test:db-connection
```

**或手动测试**:
```bash
psql "postgresql://username:postgres@171.43.138.237:5443/llmchat?sslmode=disable"
```

**预期结果**:
- 如果连接成功：凭据正确
- 如果认证失败：需要更新密码
- 如果连接超时：检查网络和防火墙

---

### 方案3: 创建独立测试数据库

**建议配置**:
```env
# 测试环境使用独立数据库
TEST_DB_NAME=llmchat_test

# 或使用完全独立的服务器
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
```

---

## 📊 配置一致性检查

### ✅ 一致的配置
- `backend/src/config/AppConfig.ts` 正确读取环境变量
- `backend/src/utils/db.ts` 使用AppConfig获取配置
- 没有硬编码的数据库连接信息

### ✅ 配置加载顺序
1. `backend/src/dotenv-loader.ts` 从根目录加载 `.env`
2. `AppConfig.getDatabaseConfig()` 读取环境变量
3. `db.ts` 使用配置创建连接池

---

## 🚨 安全建议

### 立即执行
1. ❌ 确认 `DB_PASSWORD` 不是默认值
2. ❌ 如果是生产环境，启用 SSL (`DB_SSL=true`)
3. ❌ 设置强密码策略（至少12字符，包含大小写+数字+特殊字符）

### 短期优化
4. 配置数据库MCP服务器
5. 创建独立的测试数据库
6. 启用数据库连接审计日志

### 长期规划
7. 考虑使用密钥管理服务（如HashiCorp Vault）
8. 实施数据库访问权限最小化原则
9. 定期轮换数据库密码

---

## 📝 验证清单

- [ ] 确认数据库密码是否为真实值
- [ ] 测试数据库连接是否正常
- [ ] 添加PostgreSQL MCP配置到 `.mcp.json`
- [ ] 重启Cursor并验证MCP功能
- [ ] 创建独立的测试数据库
- [ ] 检查防火墙规则（端口5443和7788）
- [ ] 验证SSL证书（如果启用SSL）
- [ ] 更新密码为强密码（如果当前是弱密码）

---

## 🔗 相关文件

- **环境配置**: `.env`
- **MCP配置**: `.mcp.json`, `.cursor/mcp.json`
- **数据库工具**: `backend/src/utils/db.ts`
- **配置服务**: `backend/src/config/AppConfig.ts`
- **环境加载器**: `backend/src/dotenv-loader.ts`

---

## 📚 参考资料

- [MCP PostgreSQL Server](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [LLMChat项目配置指南](./CLAUDE.md)

---

**生成时间**: 2025-10-20  
**检查工具**: Claude Code (Cursor AI)

