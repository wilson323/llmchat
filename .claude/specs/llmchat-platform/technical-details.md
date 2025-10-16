# LLMChat 技术规范详细说明

**版本**: 1.0.0  
**创建日期**: 2025-01-16  
**维护者**: LLMChat 开发团队  
**状态**: 生效

---

## 文档说明

本文档是所有技术实现细节的**单一真实来源（Single Source of Truth）**。

**使用原则**:
-  其他文档应引用本文档，而非复制内容
-  技术细节变更仅需修改此文档
-  引用格式：`[详见技术规范](technical-details.md#section-name)`
-  禁止在其他文档中重复技术细节

---

## 1. 认证与安全

### 1.1 JWT配置

**算法**: HS256  
**过期时间**: 1小时（3600秒）  
**刷新策略**: 滚动刷新，刷新token有效期7天  

**Payload结构**:
```typescript
{
  userId: string;
  email: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
  iss: 'llmchat-backend';
  aud: 'llmchat-frontend';
}
```

**环境变量**:
- `JWT_SECRET`: 最小长度32字符
- `JWT_ALGORITHM`: 固定为 HS256
- `JWT_EXPIRES_IN`: 1h
- `JWT_ISSUER`: llmchat-backend
- `JWT_AUDIENCE`: llmchat-frontend

**实现位置**: `backend/src/services/JWTService.ts` (任务T009)

### 1.2 密码安全

**哈希算法**: bcrypt  
**Salt Rounds**: 10  

**密码强度要求**:
- 最小长度: 8字符
- 必须包含: 大写字母、小写字母、数字

**实现位置**: `backend/src/utils/password.ts` (任务T008)

---

## 2. 性能指标（量化标准）

### 2.1 响应时间

| 指标 | P50 | P95 | P99 |
|------|-----|-----|-----|
| API响应 | <100ms | <200ms | <500ms |
| 首屏加载 | <1.5s | <3s | <5s |
| 流式TTFB | <50ms | <100ms | <200ms |

**基准负载**: 100并发用户，100 QPS

**实现位置**: `backend/src/services/MetricsService.ts` (任务T040)

### 2.2 速率限制

| 端点 | 限制 | 窗口 |
|------|------|------|
| 聊天 | 10次 | 1分钟/用户 |
| 认证 | 5次 | 5分钟/IP |
| 管理 | 100次 | 1分钟 |

**实现位置**: `backend/src/middleware/rateLimiter.ts` (任务T023)

---

## 3. 回退策略

**Fallback机制**:
1. 主提供商失败  重试3次（指数退避：1s, 2s, 4s）
2. 重试失败  切换到备用提供商
3. 备用提供商失败  返回503错误

**实现位置**: `backend/src/services/ChatProxyService.ts` (任务T020)

---

## 4. 变更日志格式

遵循 [Keep a Changelog](https://keepachangelog.com/) 格式

**类别**: Added, Changed, Deprecated, Removed, Fixed, Security

**位置**: `CHANGELOG.md`

---

**版本**: 1.0.0 | **更新**: 2025-01-16
