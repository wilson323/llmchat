# 🔒 LLMChat 安全指南

## 概述

本指南提供LLMChat项目的完整安全配置和最佳实践，确保应用程序在生产环境中的安全性。

## 📋 目录

- [安全配置](#安全配置)
- [身份认证与授权](#身份认证与授权)
- [API安全防护](#api安全防护)
- [依赖安全](#依赖安全)
- [生产环境安全](#生产环境安全)
- [安全监控](#安全监控)
- [应急响应](#应急响应)

## 🛡️ 安全配置

### 环境变量配置

创建 `.env` 文件并配置以下安全变量：

```bash
# JWT安全配置
TOKEN_SECRET=your-super-secure-jwt-secret-min-32-chars-long-please-change-this-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=1h
JWT_ISSUER=llmchat-backend
JWT_AUDIENCE=llmchat-frontend

# 数据库安全配置
DATABASE_URL=postgresql://username:password@localhost:5432/llmchat?sslmode=require
DB_SSL=true

# Redis安全配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password-here
REDIS_DB=0

# CORS安全配置
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
FRONTEND_URL=https://your-domain.com

# 安全头部配置
NODE_ENV=production
TRUST_PROXY=1
```

### 安全配置验证

```bash
# 运行安全检查
npm run security:check

# 运行完整安全扫描
npm run security:scan

# 验证环境配置
npm run validate:env
```

## 🔐 身份认证与授权

### JWT认证机制

项目使用增强版JWT认证系统，提供以下功能：

- **安全令牌生成**：使用强随机密钥和安全算法
- **令牌黑名单**：支持令牌撤销和黑名单机制
- **会话管理**：控制并发会话数量
- **自动刷新**：安全的令牌刷新机制

### 使用方法

```typescript
import { requireAuth, requireAdmin, requirePermission } from '@/middleware/enhancedJwtAuth';

// 基础认证
app.use('/api', requireAuth());

// 管理员权限
app.use('/api/admin', requireAdmin());

// 特定权限
app.use('/api/users', requirePermission('user:manage'));

// 严格认证模式
app.use('/api/sensitive', strictAuth());
```

### 权限控制

```typescript
// 检查用户权限
if (hasPermission(user.permissions, 'user:read')) {
  // 允许访问
}

// 检查用户角色
if (hasRole(user.role, 'admin')) {
  // 管理员权限
}
```

## 🛡️ API安全防护

### 增强安全中间件

项目提供多层安全防护：

1. **输入验证**：验证和清理所有输入数据
2. **威胁检测**：检测SQL注入、XSS、命令注入等攻击
3. **IP过滤**：支持IP白名单和黑名单
4. **用户代理过滤**：检测可疑用户代理
5. **CSRF保护**：防止跨站请求伪造

### 配置示例

```typescript
import { enhancedSecurityMiddleware } from '@/middleware/enhancedSecurity';

// 应用增强安全中间件
app.use(enhancedSecurityMiddleware({
  enableInputValidation: true,
  enableSQLInjectionDetection: true,
  enableXSSDetection: true,
  enableCSRFProtection: true,
  enableIPFiltering: true,
  ipBlacklist: ['192.168.1.100'], // 阻止特定IP
}));
```

### 高级速率限制

```typescript
import { createAdvancedRateLimiter, RATE_LIMIT_PRESETS } from '@/middleware/advancedRateLimit';

// 通用API限制
app.use('/api', createAdvancedRateLimiter(RATE_LIMIT_PRESETS.general));

// 严格限制（敏感操作）
app.use('/api/auth/login', createAdvancedRateLimiter(RATE_LIMIT_PRESETS.login));

// 文件上传限制
app.use('/api/upload', createAdvancedRateLimiter(RATE_LIMIT_PRESETS.upload));
```

### 自定义速率限制

```typescript
app.use('/api/custom', createAdvancedRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 30,
  blockDuration: 5 * 60 * 1000, // 5分钟
  enableAdaptive: true, // 启用自适应限制
  enableReputation: true, // 启用IP信誉系统
}));
```

## 📦 依赖安全

### 自动化安全扫描

项目包含完整的安全扫描机制：

```bash
# 依赖漏洞扫描
npm run security:audit

# 完整安全扫描
npm run security:scan

# 自动修复安全问题
npm run security:scan:fix

# 许可证合规检查
npm run security:license

# 检查过时依赖
npm run security:outdated
```

### 持续集成安全检查

项目配置了GitHub Actions安全工作流：

- **依赖漏洞扫描**：自动检测依赖中的安全漏洞
- **代码安全分析**：使用CodeQL进行静态分析
- **密钥检测**：扫描代码中的硬编码密钥
- **容器安全扫描**：检查Docker镜像中的漏洞
- **许可证合规**：确保所有依赖使用合规许可证

### 手动安全更新

```bash
# 更新依赖到最新安全版本
pnpm update

# 检查特定包的安全状态
pnpm audit package-name

# 修复特定漏洞
pnpm audit fix
```

## 🚀 生产环境安全

### 生产环境配置

使用 `ProductionSecurityConfig` 类配置生产环境安全策略：

```typescript
import { ProductionSecurityManager } from '@/config/ProductionSecurityConfig';

const securityManager = new ProductionSecurityManager({
  environment: 'production',
  enforceHTTPS: true,
  hstsMaxAge: 31536000,
  allowedOrigins: ['https://your-domain.com'],
  rateLimiting: {
    enabled: true,
    general: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
    },
  },
});

// 应用所有安全中间件
app.use(securityManager.getMiddlewares());
```

### 安全健康检查

```typescript
// 获取安全健康状态
const healthStatus = await securityManager.getHealthStatus();
console.log('安全状态:', healthStatus);

// 验证配置
const validation = securityManager.validateConfig();
if (!validation.valid) {
  console.error('安全配置错误:', validation.errors);
}
```

### HTTPS配置

1. **启用HSTS**：强制使用HTTPS
2. **安全证书**：使用有效的SSL证书
3. **TLS配置**：使用安全的TLS版本和密码套件

### 安全头部配置

项目自动配置以下安全头部：

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## 📊 安全监控

### 日志记录

项目提供多层次的安全日志：

```typescript
// 审计日志
console.log(JSON.stringify({
  type: 'audit_request',
  timestamp: new Date().toISOString(),
  method: req.method,
  url: req.originalUrl,
  ip: req.ip,
  userId: user.id,
}));

// 安全事件日志
logger.warn('Security threat detected', {
  ip: req.ip,
  threatType: 'sql_injection',
  evidence: 'SELECT * FROM users',
});
```

### 监控指标

监控以下安全指标：

- **认证失败率**：登录失败和令牌验证失败
- **速率限制触发**：请求过于频繁的IP
- **威胁检测**：检测到的攻击尝试
- **异常访问**：来自可疑IP的访问
- **权限违规**：未授权的访问尝试

### 告警配置

配置安全事件告警：

```typescript
// 严重安全事件告警
if (threatSeverity === 'critical') {
  // 发送邮件/短信/Slack通知
  sendSecurityAlert({
    type: 'critical_threat',
    message: `Critical security threat detected: ${threatType}`,
    ip: req.ip,
    timestamp: new Date(),
  });
}
```

## 🚨 应急响应

### 安全事件分类

| 级别 | 描述 | 响应时间 |
|------|------|----------|
| P0 | 系统被入侵、数据泄露 | 立即（15分钟内） |
| P1 | 严重漏洞、大量攻击 | 1小时内 |
| P2 | 一般漏洞、少量攻击 | 24小时内 |
| P3 | 安全配置问题 | 1周内 |

### 应急响应流程

1. **检测**：监控系统检测到安全事件
2. **评估**：评估事件严重程度和影响范围
3. **响应**：根据严重程度采取相应措施
4. **恢复**：恢复系统正常运行
5. **分析**：分析事件原因和改进措施

### 常见安全事件处理

#### SQL注入攻击

```typescript
// 检测到SQL注入
if (threat.type === 'sql_injection') {
  // 1. 阻止IP
  await blockIP(req.ip, 24 * 60 * 60 * 1000); // 24小时

  // 2. 记录详细日志
  logger.error('SQL injection attempt blocked', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    payload: req.body,
    sql: evidence,
  });

  // 3. 发送告警
  await sendSecurityAlert({
    type: 'sql_injection',
    severity: 'high',
    ip: req.ip,
  });
}
```

#### 暴力破解攻击

```typescript
// 检测到暴力破解
if (isBruteForceAttack(req.ip)) {
  // 1. 增强速率限制
  await applyStrictRateLimit(req.ip);

  // 2. 要求验证码
  if (shouldRequireCaptcha(req.ip)) {
    return res.status(429).json({
      error: 'Too many requests',
      requireCaptcha: true,
    });
  }

  // 3. 通知用户
  await notifyUserSecurity(user.id, 'brute_force_detected');
}
```

## 🔧 安全最佳实践

### 开发安全

1. **代码审查**：所有代码变更必须经过安全审查
2. **安全培训**：定期进行安全意识培训
3. **威胁建模**：在设计阶段识别潜在威胁
4. **安全测试**：包含安全测试的测试用例

### 运维安全

1. **最小权限原则**：只授予必要的权限
2. **定期更新**：及时更新系统和依赖
3. **备份验证**：定期验证备份的完整性
4. **监控告警**：配置完善的安全监控和告警

### 数据保护

1. **数据分类**：根据敏感性对数据进行分类
2. **加密存储**：敏感数据加密存储
3. **访问控制**：严格的数据访问控制
4. **数据清理**：定期清理不再需要的数据

## 📞 安全联系

### 安全团队

- **安全负责人**：security@your-domain.com
- **技术支持**：support@your-domain.com
- **漏洞报告**：security@your-domain.com

### 漏洞报告

如果您发现安全漏洞，请通过以下方式报告：

1. **加密邮件**：security@your-domain.com
2. **GitHub Issues**：创建私有安全issue
3. **安全平台**：通过公司安全平台报告

### 响应时间承诺

- **严重漏洞**：24小时内响应
- **一般漏洞**：72小时内响应
- **信息查询**：7个工作日内响应

---

**重要提醒**：

1. 本指南会随着安全威胁的变化持续更新
2. 所有配置变更都必须经过测试验证
3. 定期进行安全评估和渗透测试
4. 保持与安全社区的交流和学习

**最后更新**：2025年10月18日
**版本**：1.0.0