# LLMChat - 智能体切换聊天应用

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2+-blue.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18.0+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个现代化的智能体切换聊天应用，支持多个AI提供商（FastGPT、OpenAI、Anthropic、Dify）之间的动态切换，提供企业级的实时聊天体验。

## ✨ 核心特性

### 🤖 多智能体支持
- **无缝切换**: 用户可在不同AI提供商间切换
- **统一接口**: 标准化的API接口，支持多种AI模型
- **动态配置**: 运行时配置热重载，支持自定义智能体
- **状态保持**: 切换时保持当前会话状态

### 💬 实时流式聊天
- **SSE流式响应**: Server-Sent Events 实时数据推送
- **多事件支持**: reasoning、interactive、status等丰富事件类型
- **智能缓冲**: 性能优化的消息缓冲机制
- **断线重连**: 自动重连和状态恢复

### 🎨 丰富的交互功能
- **文件上传**: 支持PDF、DOCX、TXT等多种格式
- **语音消息**: 语音录制和播放功能
- **CAD文件**: 专门的CAD文件处理和预览
- **交互式表单**: 动态表单生成和按钮交互
- **初始化变量**: 智能体初始化配置

### 🛡️ 企业级安全
- **JWT认证**: 安全的用户认证和授权
- **权限控制**: 基于角色的权限管理
- **输入验证**: 严格的输入验证和清理
- **审计日志**: 完整的操作审计追踪
- **速率限制**: 多层API访问保护

### 📊 监控与可视化
- **实时仪表板**: 系统状态和性能监控
- **数据可视化**: ECharts图表展示
- **告警系统**: 智能告警和通知
- **性能监控**: API响应时间和系统资源监控

## 🏗️ 技术架构

### 前端架构
```
React 18 + TypeScript
├── Zustand (状态管理)
├── Vite (构建工具)
├── Tailwind CSS (样式框架)
├── React Router (路由管理)
└── Playwright (E2E测试)
```

### 后端架构
```
Node.js + Express + TypeScript
├── PostgreSQL (主数据库)
├── Redis (缓存和会话)
├── JWT (认证授权)
├── Winston (日志系统)
└── Jest (单元测试)
```

### 关键特性
- **TypeScript 严格模式**: 100%类型安全
- **模块化设计**: 清晰的组件和服务分层
- **性能优化**: 代码分割、懒加载、虚拟化
- **安全第一**: 多层安全防护机制
- **可观测性**: 完整的监控和日志系统

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0
- pnpm >= 8.0.0

### 安装和运行

#### 1. 克隆项目
```bash
git clone https://github.com/wilson323/llmchat.git
cd llmchat
```

#### 2. 安装依赖
```bash
pnpm install
```

#### 3. 配置环境变量
```bash
# 复制环境变量模板
cp backend/.env.example backend/.env
cp config/agents.example.json config/agents.json

# 编辑环境变量
nano backend/.env
```

#### 4. 启动开发服务
```bash
# 并发启动前后端开发服务
pnpm run dev

# 或分别启动
pnpm run backend:dev  # 后端: http://localhost:3001
pnpm run frontend:dev # 前端: http://localhost:3000
```

#### 5. 访问应用
- 前端应用: http://localhost:3000
- 后端API: http://localhost:3001
- API文档: http://localhost:3001/api/docs

### Docker 部署

#### 构建镜像
```bash
docker build -t llmchat .
```

#### 运行容器
```bash
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e TOKEN_SECRET="your-jwt-secret" \
  llmchat
```

## 📚 项目文档

### 核心文档
- [技术宪法](TEAM_TECHNICAL_CONSTITUTION.md) - 团队技术原则和规范
- [项目架构](docs/PROJECT_ARCHITECTURE.md) - 完整的架构设计文档
- [开发规范](docs/DEVELOPMENT_GUIDE.md) - 详细的开发规范和实施指南
- [API文档](docs/API.md) - 完整的API接口文档

### 用户文档
- [用户指南](docs/USER_GUIDE.md) - 用户使用指南
- [管理员手册](docs/ADMIN_MANUAL.md) - 系统管理手册
- [故障排除](docs/TROUBLESHOOTING.md) - 常见问题和解决方案

### 开发文档
- [代码审查检查清单](docs/CODE_REVIEW_CHECKLIST.md) - 代码审查标准
- [实施指南](docs/IMPLEMENTATION_GUIDE.md) - 团队实施和落地指导
- [部署指南](docs/DEPLOYMENT.md) - 部署和运维指南

## 🧪 质量保证

### 测试覆盖
- **单元测试**: > 80%
- **集成测试**: > 70%
- **E2E测试**: 关键流程 100%
- **类型安全**: 100%

### 质量检查
```bash
# 完整质量检查
pnpm run quality-check

# 快速检查
pnpm run quality-check:quick

# 查看详细报告
pnpm run quality-report
```

### 性能指标
- **API响应时间**: < 200ms (P95)
- **页面加载时间**: < 3s
- **并发用户数**: > 1000
- **系统可用性**: > 99.9%

## 🔧 开发工具

### 代码质量工具
- **TypeScript**: 严格类型检查
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Husky**: Git hooks 管理

### 构建工具
- **Vite**: 快速构建工具
- **TypeScript Compiler**: 类型检查和编译
- **Webpack**: 生产环境构建
- **Babel**: JavaScript 转译

### 测试工具
- **Vitest**: 前端单元测试
- **Jest**: 后端单元测试
- **Playwright**: E2E测试
- **Testing Library**: React组件测试

## 🔒 安全特性

### 认证和授权
- **JWT Token**: 安全的令牌认证机制
- **权限控制**: 基于角色的权限管理
- **Token 撤销**: 支持令牌撤销和刷新
- **会话管理**: 安全的会话管理

### 输入验证
- **Joi 验证**: 严格的输入验证
- **SQL 注入防护**: 参数化查询
- **XSS 防护**: 输出编码和 CSP 策略
- **CSRF 防护**: 跨站请求伪造防护

### 数据保护
- **敏感数据脱敏**: 自动敏感信息屏蔽
- **数据加密**: 关键数据加密存储
- **审计日志**: 完整的操作审计
- **备份策略**: 定期数据备份

## 📊 监控和可观测性

### 应用监控
- **性能监控**: API 响应时间和吞吐量
- **错误监控**: 错误率和异常追踪
- **业务监控**: 用户行为和功能使用统计
- **资源监控**: 系统资源使用情况

### 日志系统
- **结构化日志**: JSON 格式日志
- **日志聚合**: 集中化日志管理
- **日志查询**: 便捷的日志搜索和分析
- **告警通知**: 自动告警和通知

### 性能分析
- **APM 工具**: 应用性能监控
- **Profiler**: 性能分析和优化
- **指标收集**: 关键性能指标收集
- **趋势分析**: 性能趋势分析

## 🤝 贡献指南

### 开发流程
1. **Fork 项目**: 在 GitHub 上 Fork 项目
2. **创建分支**: 创建功能分支
3. **开发功能**: 按照开发规范开发
4. **编写测试**: 编写完整的测试用例
5. **提交 PR**: 创建 Pull Request
6. **代码审查**: 通过代码审查后合并

### 代码规范
- 遵循 [开发规范](docs/DEVELOPMENT_GUIDE.md)
- 通过所有质量检查
- 编写完整的测试覆盖
- 更新相关文档

### 提交规范
- 使用 Conventional Commits 规范
- 提交信息清晰明确
- 关联相关 Issue
- 通过 CI/CD 检查

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献者

感谢所有为项目做出贡献的开发者！

## 📞 联系方式

- **GitHub Issues**: [项目Issues](https://github.com/wilson323/llmchat/issues)
- **技术讨论**: [项目Discussions](https://github.com/wilson323/llmchat/discussions)
- **邮件联系**: [项目邮箱](mailto:contact@example.com)

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star!

*最后更新: 2025-10-13*