# 数据库迁移指南

## 📋 概述

本项目使用自定义的数据库迁移系统来管理 PostgreSQL 数据库的 schema 变更。迁移系统提供版本化的数据库管理，支持 `up` (前进) 和 `down` (回滚) 操作。

## 🏗️ 架构

### 核心组件

1. **MigrationManager** (`backend/src/utils/migrate.ts`)
   - 迁移管理器核心类
   - 提供 `migrateUp()`, `migrateDown()`, `getStatus()` 等方法
   - 自动跟踪已执行的迁移

2. **CLI 工具** (`backend/src/scripts/migrate.ts`)
   - 命令行接口，用于执行迁移命令
   - 支持 `up`, `down`, `status`, `mark` 命令

3. **迁移脚本目录** (`backend/src/migrations/`)
   - 存放所有迁移SQL脚本
   - 文件命名格式: `{version}_{name}.sql`
   - 示例: `001_create_users_table.sql`

4. **跟踪表** (`schema_migrations`)
   - 自动创建，记录已执行的迁移
   - 字段: `version`, `name`, `executed_at`

## 📝 迁移脚本格式

迁移脚本使用 SQL 格式，包含 `-- UP` 和 `-- DOWN` 两部分：

```sql
-- UP
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- DOWN
DROP INDEX IF EXISTS idx_users_username;
DROP TABLE IF EXISTS users;
```

### 命名规范

- **版本号**: 3位数字，从 `001` 开始，递增
- **名称**: 小写字母和下划线，描述迁移内容
- **格式**: `{version}_{name}.sql`

示例:
- `001_create_users_table.sql`
- `002_create_logs_table.sql`
- `003_add_email_to_users.sql`

## 🚀 使用方法

### 查看迁移状态

```bash
cd backend
npm run migrate:status
```

输出示例:
```
📊 数据库迁移状态

总迁移数: 7
已执行: 5
待执行: 2

✅ 已执行的迁移:

  001: create users table (执行时间: 2025-10-02 14:30:15)
  002: create logs table (执行时间: 2025-10-02 14:30:16)
  ...

⏳ 待执行的迁移:

  006: create chat geo events table
  007: create audit logs
```

### 执行待执行的迁移

```bash
cd backend
npm run migrate:up
```

输出示例:
```
🚀 执行数据库迁移...

✅ 成功执行 2 个迁移:

  - 006: create chat geo events table
  - 007: create audit logs
```

### 回滚最后一次迁移

```bash
cd backend
npm run migrate:down
```

或指定回滚步数:
```bash
cd backend
npm run migrate -- down 3  # 回滚最后3次迁移
```

### 标记迁移为已执行（高级）

如果手动执行了迁移或需要跳过某个迁移，可以手动标记：

```bash
cd backend
npm run migrate -- mark 001 "create users table"
```

⚠️ **警告**: 这是一个危险操作，仅在你清楚了解后果的情况下使用。

## 📂 现有迁移脚本

当前项目包含以下迁移脚本：

| 版本 | 名称 | 说明 |
|------|------|------|
| 001 | create_users_table | 创建用户表，包含认证信息 |
| 002 | create_logs_table | 创建日志表 |
| 003 | create_agent_configs_table | 创建智能体配置表 |
| 004 | create_chat_sessions_table | 创建聊天会话表 |
| 005 | create_chat_messages_table | 创建聊天消息表 |
| 006 | create_chat_geo_events_table | 创建地理事件表 |
| 007 | create_audit_logs | 创建审计日志表和索引 |

## ✍️ 创建新迁移

### 步骤1: 创建迁移文件

在 `backend/src/migrations/` 目录下创建新的 SQL 文件：

```bash
# 文件名格式: {next_version}_{description}.sql
# 示例: 008_add_email_to_users.sql
```

### 步骤2: 编写迁移SQL

```sql
-- UP
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- DOWN
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP COLUMN IF EXISTS email;
```

### 步骤3: 测试迁移

```bash
cd backend

# 1. 检查状态
npm run migrate:status

# 2. 执行新迁移
npm run migrate:up

# 3. 验证数据库变更
# (连接数据库查看表结构)

# 4. (可选) 测试回滚
npm run migrate:down

# 5. 重新执行
npm run migrate:up
```

### 步骤4: 提交到版本控制

```bash
git add backend/src/migrations/008_add_email_to_users.sql
git commit -m "feat(db): add email column to users table"
```

## 🔐 最佳实践

### DO ✅

1. **总是提供 DOWN 脚本**: 确保迁移可以回滚
2. **使用 IF EXISTS / IF NOT EXISTS**: 使迁移幂等，可以安全地重复执行
3. **使用事务**: MigrationManager 自动在事务中执行每个迁移
4. **测试迁移**: 在开发环境测试迁移的 up 和 down 操作
5. **小步前进**: 每个迁移只做一件事，避免复杂的多表变更
6. **命名清晰**: 使用描述性的名称，便于理解迁移目的

### DON'T ❌

1. **不要修改已执行的迁移**: 已执行的迁移不应该被修改，应创建新的迁移
2. **不要跳过版本号**: 版本号必须连续递增
3. **不要在迁移中使用硬编码数据**: 避免依赖特定环境的数据
4. **不要在迁移中使用外部脚本**: 保持迁移纯SQL，便于审查和执行
5. **不要忽略 DOWN 脚本**: 即使你认为不会回滚，也要提供 DOWN 脚本

## 🔧 故障排除

### 问题1: 迁移执行失败

**症状**: 迁移执行中途失败，数据库处于不一致状态

**解决方案**:
```bash
# 1. 检查错误信息
npm run migrate:up

# 2. 如果迁移部分成功，手动修复数据库
# (连接数据库，手动执行或回滚SQL)

# 3. 标记迁移状态
npm run migrate:status

# 4. 如果需要，手动标记或取消标记
# (谨慎使用,仅在清楚了解情况下)
```

### 问题2: 迁移记录与实际数据库不一致

**症状**: `schema_migrations` 表记录的迁移与实际数据库结构不匹配

**解决方案**:
```bash
# 1. 备份数据库
pg_dump -U your_user llmchat > backup.sql

# 2. 检查迁移状态
npm run migrate:status

# 3. 选择以下方案之一:

# 方案A: 重置并重新迁移 (仅开发环境)
# DROP DATABASE llmchat;
# CREATE DATABASE llmchat;
# npm run migrate:up

# 方案B: 手动标记迁移为已执行
npm run migrate -- mark <version> "<name>"
```

### 问题3: 无法连接数据库

**症状**: 迁移工具无法连接到 PostgreSQL

**解决方案**:
```bash
# 1. 检查环境变量
cat .env | grep DB_

# 2. 检查 PostgreSQL 服务状态
# Windows: 检查服务管理器
# Linux/Mac: sudo systemctl status postgresql

# 3. 测试数据库连接
psql -h localhost -U your_user -d llmchat

# 4. 更新 .env 或 config/config.jsonc 中的数据库配置
```

## 📚 高级用法

### 数据迁移

对于包含数据变更的迁移，确保考虑性能和数据完整性：

```sql
-- UP
-- 1. 添加新列 (可空)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. 迁移数据 (分批处理大表)
UPDATE users SET email = username || '@example.com' WHERE email IS NULL;

-- 3. 设置非空约束 (如需要)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- DOWN
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP COLUMN IF EXISTS email;
```

### 条件迁移

使用 PostgreSQL 的 `DO` 块实现条件逻辑：

```sql
-- UP
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'email') THEN
        ALTER TABLE users ADD COLUMN email TEXT;
    END IF;
END $$;

-- DOWN
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'email') THEN
        ALTER TABLE users DROP COLUMN email;
    END IF;
END $$;
```

### 集成到CI/CD

在部署流程中自动执行迁移：

```yaml
# .github/workflows/deploy.yml
steps:
  - name: Run Database Migrations
    run: |
      cd backend
      npm install
      npm run migrate:up
    env:
      DB_HOST: ${{ secrets.DB_HOST }}
      DB_USER: ${{ secrets.DB_USER }}
      DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
      DB_NAME: ${{ secrets.DB_NAME }}
```

## 🔗 相关文档

- [README.md](../README.md) - 项目主文档
- [SECURITY_GUIDE.md](requirements/SECURITY_GUIDE.md) - 安全配置指南
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)

---

**最后更新**: 2025-10-02  
**维护者**: LLMChat 开发团队

