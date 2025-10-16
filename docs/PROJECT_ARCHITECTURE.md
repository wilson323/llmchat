# LLMChat 项目架构文档

## 📋 项目概述

LLMChat 是一个智能体切换聊天应用，支持多个AI提供商（FastGPT、OpenAI、Anthropic、Dify）之间的动态切换。项目采用前后端分离架构，提供现代化的实时聊天体验和丰富的AI交互功能。

## 🏗️ 技术架构概览

### 技术栈
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **后端**: Node.js + Express + TypeScript + PostgreSQL + Redis
- **共享类型**: 统一的TypeScript类型定义
- **测试**: Jest (后端) + Vitest (前端) + Playwright (E2E)
- **构建**: Vite (前端) + TypeScript Compiler (后端)

### 架构模式
- **前端**: 组件化架构 + 状态管理 + 懒加载
- **后端**: 分层架构 + 适配器模式 + 依赖注入
- **数据流**: 实时流式响应 + 状态同步 + 缓存策略

## 🎯 核心功能模块

### 1. 智能体管理系统

#### 1.1 智能体配置
- **多数据源支持**: 数据库 + JSON文件 + 默认配置
- **动态配置**: 运行时配置热重载
- **提供商适配**: FastGPT、OpenAI、Anthropic、Dify统一接口
- **配置验证**: 严格的配置验证和安全检查

#### 1.2 智能体切换
- **无缝切换**: 用户可在不同智能体间切换
- **会话隔离**: 每个智能体独立的会话历史
- **状态保持**: 切换时保持当前会话状态
- **权限控制**: 管理员权限控制智能体创建和修改

#### 1.3 智能体健康检查
- **实时监控**: 智能体连接状态和可用性
- **自动故障转移**: 主智能体不可用时的备用方案
- **性能监控**: 响应时间和成功率统计
- **告警机制**: 异常状态自动告警

### 2. 聊天系统核心

#### 2.1 实时流式聊天
- **SSE流式响应**: Server-Sent Events实时数据推送
- **多事件支持**: reasoning、interactive、status等事件类型
- **消息缓冲**: 性能优化的消息缓冲机制
- **断线重连**: 自动重连和状态恢复

#### 2.2 多媒体支持
- **文件上传**: 支持多种文件格式（PDF、DOCX、TXT等）
- **语音消息**: 语音录制和播放功能
- **CAD文件**: 专门的CAD文件处理和预览
- **图片处理**: 图片显示和处理功能

#### 2.3 交互功能
- **初始化变量**: 支持智能体初始化配置
- **交互式表单**: 动态表单生成和处理
- **按钮交互**: 用户可点击的按钮和操作
- **工具调用**: 智能体工具调用和结果处理

### 3. 会话管理系统

#### 3.1 会话持久化
- **本地存储**: 用户会话数据本地持久化
- **云端同步**: 支持会话数据的云端同步
- **离线支持**: 离线模式下会话数据可用
- **数据恢复**: 自动数据备份和恢复机制

#### 3.2 会话搜索
- **全文搜索**: 会话内容全文搜索
- **智能过滤**: 按智能体、时间、标签过滤
- **语义搜索**: 基于语义的智能搜索
- **搜索历史**: 搜索历史和建议

#### 3.3 会话管理
- **会话分组**: 按智能体自动分组会话
- **会话标签**: 用户可添加标签和备注
- **会话导出**: 支持多种格式的会话导出
- **会话分享**: 会话分享和协作功能

### 4. 用户认证与授权

#### 4.1 用户管理
- **安全认证**: JWT Token认证机制
- **权限控制**: 基于角色的权限管理
- **用户状态**: 登录状态自动维护
- **会话管理**: 安全的会话管理

#### 4.2 权限系统
- **管理员权限**: 系统管理和配置权限
- **普通用户权限**: 基础聊天和使用权限
- **API权限**: 细粒度的API访问控制
- **资源保护**: 敏感资源的访问保护

#### 4.3 安全机制
- **密码安全**: 安全的密码存储和验证
- **Token管理**: 安全的Token生成、验证和撤销
- **速率限制**: API访问速率限制
- **审计日志**: 完整的操作审计追踪

### 5. 监控与可视化

#### 5.1 实时监控
- **系统监控**: 服务器资源使用监控
- **性能监控**: API响应时间和吞吐量监控
- **错误监控**: 错误率和异常监控
- **用户行为**: 用户活跃度和功能使用统计

#### 5.2 数据可视化
- **ECharts集成**: 丰富的图表展示
- **实时仪表板**: 实时数据展示界面
- **交互式图表**: 用户可交互的数据图表
- **数据导出**: 图表数据的导出功能

#### 5.3 告警系统
- **阈值告警**: 基于阈值的自动告警
- **异常检测**: 异常模式自动检测
- **通知机制**: 多渠道通知（邮件、短信、Webhook）
- **告警历史**: 告警历史和趋势分析

## 🔄 数据流架构

### 前端数据流
```
用户操作 → 组件事件 → Zustand Store → API服务 → 后端接口
                ↓
              UI更新 ← 状态订阅 ← Store更新 ← 响应数据
```

### 后端数据流
```
API请求 → 中间件 → 控制器 → 服务层 → 数据访问层 → 数据库
          ↓
        响应 ← 错误处理 ← 业务逻辑 ← 数据处理 ← 查询结果
```

### 实时数据流
```
AI提供商 → ChatProxy → SSE事件流 → 前端SSE处理 → UI实时更新
```

## 🗂️ 数据库设计

### 核心表结构

#### 用户表 (users)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 智能体配置表 (agent_configs)
```sql
CREATE TABLE agent_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  api_key TEXT NOT NULL,
  capabilities JSONB DEFAULT '[]',
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 聊天会话表 (chat_sessions)
```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_configs(id),
  title TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 聊天消息表 (chat_messages)
```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 审计日志表 (audit_logs)
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS'
);
```

### 数据关系
- 用户 → 会话 (1:N)
- 智能体 → 会话 (1:N)
- 会话 → 消息 (1:N)
- 所有操作 → 审计日志

## 🛡️ 安全架构

### 安全层次
1. **网络层**: HTTPS、CORS配置、防火墙
2. **应用层**: JWT认证、权限控制、输入验证
3. **数据层**: 数据库加密、敏感数据脱敏
4. **监控层**: 安全监控、异常检测、审计日志

### 安全措施
- **认证机制**: JWT Token + 刷新机制
- **授权控制**: 基于角色的权限管理
- **输入验证**: 严格的输入验证和清理
- **SQL注入防护**: 参数化查询
- **XSS防护**: 输出编码和CSP策略
- **速率限制**: 多层API速率限制
- **审计日志**: 完整的操作审计

## ⚡ 性能优化

### 前端性能优化
- **代码分割**: 按功能模块分割代码
- **懒加载**: 组件和路由懒加载
- **虚拟化**: 长列表虚拟化
- **缓存策略**: 智能缓存机制
- **性能监控**: 实时性能监控

### 后端性能优化
- **连接池**: 数据库连接池优化
- **缓存层**: Redis缓存策略
- **查询优化**: 数据库查询优化
- **压缩传输**: Gzip响应压缩
- **并发控制**: 合理的并发控制

### 性能指标
- **API响应时间**: < 200ms (P95)
- **页面加载时间**: < 3s
- **并发用户数**: > 1000
- **系统可用性**: > 99.9%

## 🧪 测试策略

### 测试金字塔
```
    E2E Tests (10%)
   ┌─────────────────┐
  Integration Tests (20%)
 ┌───────────────────────┐
Unit Tests (70%)
└─────────────────────────┘
```

### 测试覆盖
- **单元测试**: > 80%
- **集成测试**: > 70%
- **E2E测试**: 关键流程100%
- **安全测试**: 关键安全点100%

### 测试工具
- **前端**: Vitest + Testing Library
- **后端**: Jest + Supertest
- **E2E**: Playwright
- **性能**: Lighthouse
- **安全**: OWASP ZAP

## 📦 部署架构

### 部署环境
- **开发环境**: 本地开发和测试
- **测试环境**: 自动化测试环境
- **预生产环境**: 生产前验证环境
- **生产环境**: 正式服务环境

### 部署方式
- **容器化**: Docker容器化部署
- **编排**: Kubernetes集群管理
- **CI/CD**: GitHub Actions自动化流水线
- **监控**: Prometheus + Grafana

### 扩展性
- **水平扩展**: 负载均衡和多实例部署
- **垂直扩展**: 资源动态调整
- **数据库扩展**: 读写分离和分片
- **缓存扩展**: 分布式缓存

## 📚 文档体系

### 开发文档
- [技术宪法](TEAM_TECHNICAL_CONSTITUTION.md) - 团队技术原则和规范
- [开发规范](docs/DEVELOPMENT_STANDARDS.md) - 详细的开发规范和最佳实践
- [API文档](docs/API.md) - 完整的API接口文档
- [部署指南](docs/DEPLOYMENT.md) - 部署和运维指南

### 用户文档
- [用户指南](docs/USER_GUIDE.md) - 用户使用指南
- [管理员手册](docs/ADMIN_MANUAL.md) - 系统管理手册
- [故障排除](docs/TROUBLESHOOTING.md) - 常见问题和解决方案

### 项目文档
- [更新日志](CHANGELOG.md) - 项目更新历史
- [贡献指南](CONTRIBUTING.md) - 贡献者指南
- [许可证](LICENSE) - 项目许可证

## 🚀 未来规划

### 短期目标 (1-3个月)
- [ ] 完善测试覆盖率
- [ ] 优化性能指标
- [ ] 增强安全防护
- [ ] 完善文档体系

### 中期目标 (3-6个月)
- [ ] 微服务架构重构
- [ ] 多租户支持
- [ ] 插件系统
- [ ] 国际化支持

### 长期目标 (6-12个月)
- [ ] AI能力增强
- [ ] 企业级功能
- [ ] 移动端支持
- [ ] 开放API生态

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- **GitHub Issues**: [项目Issues](https://github.com/wilson323/llmchat/issues)
- **技术讨论**: [项目Discussions](https://github.com/wilson323/llmchat/discussions)
- **邮件联系**: [项目邮箱](mailto:contact@example.com)

---

*最后更新: 2025-10-13*