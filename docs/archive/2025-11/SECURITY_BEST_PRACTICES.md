# LLMChat 安全最佳实践指南

**文档版本**: 1.0
**最后更新**: 2025年10月18日
**适用范围**: 生产环境部署

## 📋 目录

1. [概述](#概述)
2. [安全配置](#安全配置)
3. [认证与授权](#认证与授权)
4. [数据保护](#数据保护)
5. [网络安全](#网络安全)
6. [监控与审计](#监控与审计)
7. [运维安全](#运维安全)
8. [应急响应](#应急响应)

---

## 🎯 概述

本文档提供了LLMChat平台的安全最佳实践指南，涵盖从开发到部署的完整安全生命周期。遵循这些实践可以帮助建立企业级的安全防护体系。

### 安全原则

1. **零信任架构** - 不信任任何未经验证的请求
2. **最小权限原则** - 只授予完成工作所需的最小权限
3. **深度防御** - 在多个层面实施安全控制
4. **持续监控** - 实时监控和响应安全事件
5. **自动化优先** - 自动化安全检查和响应流程

---

## 🔐 安全配置

### 环境变量安全

#### 1. JWT配置

```bash
# ✅ 安全的JWT配置
TOKEN_SECRET=09f79d4ce5d00635bf37f415384bc108353b98d10309d8cea6e1dc3533185bfd5e2edbade60d09dc5094e5fe7aaddf9ae1d39ea84bbe918a28b0184cc72d775a
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=llmchat-backend
JWT_AUDIENCE=llmchat-frontend

# ❌ 不安全的配置
TOKEN_SECRET=weak_password
JWT_EXPIRES_IN=365d  # 过长的过期时间
```

#### 2. 数据库连接安全

```bash
# ✅ 安全的数据库连接
DATABASE_URL=postgresql://username:password@db-host:5432/llmchat?sslmode=require&sslcert=/path/to/cert.pem&sslkey=/path/to/key.pem

# 连接池安全配置
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_SSL=true
```

#### 3. Redis连接安全

```bash
# ✅ 安全的Redis连接
REDIS_URL=redis://username:password@redis-host:6379/0
REDIS_SSL=true
REDIS_TLS_CA_CERT=/path/to/ca.pem
REDIS_TLS_CERT=/path/to/redis.crt
REDIS_TLS_KEY=/path/to/redis.key
```

### 配置验证

使用提供的工具验证配置安全性：

```bash
# 验证当前配置
ts-node scripts/generate-secure-secret.ts validate

# 生成新的安全配置
ts-node scripts/generate-secure-secret.ts generate
```

---

## 🔒 认证与授权

### JWT最佳实践

#### 1. 密钥管理

```typescript
// ✅ 安全的JWT实现
import { SecureJWT } from '@/utils/secureJwt';

// 使用强密钥（最少32字符）
const token = SecureJWT.createToken({
  userId: 'user123',
  email: 'user@example.com',
  role: 'admin'
});

// 验证令牌
const payload = SecureJWT.verifyToken(token);
```

#### 2. 令牌轮换

```typescript
// 定期轮换令牌
class TokenRotationService {
  static refreshTokenIfNeeded(token: string): string | null {
    const decoded = SecureJWT.decodeToken(token);
    if (!decoded || !decoded.exp) return null;

    // 在过期前30分钟轮换
    const timeUntilExpiry = decoded.exp * 1000 - Date.now();
    if (timeUntilExpiry < 30 * 60 * 1000) {
      return SecureJWT.refreshToken(token);
    }

    return null;
  }
}
```

#### 3. 黑名单机制

```typescript
// 实现JWT黑名单
class JWTBlacklist {
  private static blacklist = new Set<string>();

  static addToBlacklist(token: string): void {
    this.blacklist.add(token);
    // 设置自动过期
    setTimeout(() => {
      this.blacklist.delete(token);
    }, 7 * 24 * 60 * 60 * 1000); // 7天
  }

  static isBlacklisted(token: string): boolean {
    return this.blacklist.has(token);
  }
}
```

### 密码策略

#### 1. 密码要求

```typescript
interface PasswordPolicy {
  minLength: 12;        // 最小长度
  maxLength: 128;       // 最大长度
  requireUppercase: true; // 需要大写字母
  requireLowercase: true; // 需要小写字母
  requireNumbers: true;   // 需要数字
  requireSpecialChars: true; // 需要特殊字符
  preventReuse: 5;      // 防止重用最近5个密码
  expireDays: 90;        // 90天过期
  lockoutAttempts: 5;   // 5次失败后锁定
  lockoutDuration: 30;  // 锁定30分钟
}
```

#### 2. 密码哈希

```typescript
import bcrypt from 'bcrypt';

class PasswordService {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

---

## 🛡️ 数据保护

### 加密策略

#### 1. 传输层加密

```typescript
// 强制HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' &&
      req.header('x-forwarded-proto') !== 'https, https' &&
      !req.secure) {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  next();
});
```

#### 2. 敏感数据加密

```typescript
import crypto from 'crypto';

class DataEncryption {
  private static algorithm = 'aes-256-gcm';
  private static keyLength = 32;

  static encrypt(data: string, key: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, Buffer.from(key, 'hex'));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex')
    };
  }

  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }, key: string): string {
    const decipher = crypto.createDecipher(this.algorithm, Buffer.from(key, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 数据脱敏

```typescript
class LogSanitizer {
  private static sensitivePatterns = [
    { pattern: /password/i, replacement: '[REDACTED]' },
    { pattern: /token/i, replacement: '[REDACTED]' },
    { pattern: /secret/i, replacement: '[REDACTED]' },
    { pattern: /api[_-]?key/i, replacement: '[REDACTED]' },
    { pattern: /credit[_-]?card/i, replacement: '[CARD-NUMBER]' },
    { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, replacement: '[CARD-NUMBER]' }
  ];

  static sanitize(message: string): string {
    let sanitized = message;
    for (const { pattern, replacement } of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }
}
```

---

## 🌐 网络安全

### CORS配置

```typescript
// 生产环境CORS配置
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://your-domain.com',
      'https://www.your-domain.com'
    ];

    if (!origin) return callback(null, false);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      logSecurityEvent('CORS violation', { origin, allowedOrigins });
      return callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
  maxAge: 86400, // 24小时缓存
  optionsSuccessStatus: 204
};
```

### 安全头部

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000, // 1年
    includeSubDomains: true,
    preload: true
  }
}));
```

### 速率限制

```typescript
import rateLimit from 'express-rate-limit';

// 一般速率限制
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每IP最多100个请求
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 敏感操作严格限制
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 每IP最多5个请求
  skipSuccessfulRequests: false
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for sensitive operations.'
  }
});

// 登录保护
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3, // 每IP最多3次登录尝试
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip + ':' + (req.body?.email || req.ip),
  handler: (req, res) => {
    logSecurityEvent('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent')
    });
  }
});
```

---

## 📊 监控与审计

### 安全事件记录

```typescript
enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  ACCESS_DENIED = 'ACCESS_DENIED',
  MALICIOUS_REQUEST = 'MALICIOUS_REQUEST',
  DATA_ACCESS = 'DATA_ACCESS',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  ip: string;
  userAgent?: string;
  details: Record<string, unknown>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class SecurityLogger {
  static log(event: SecurityEvent): void {
    const logEntry = {
      ...event,
      timestamp: new Date().toISOString(),
      service: 'llmchat-backend'
    };

    // 结构化日志记录
    logger.info('SECURITY_EVENT', logEntry);

    // 高危事件立即告警
    if (event.severity === 'critical' || event.severity === 'high') {
      this.sendAlert(event);
    }
  }

  static sendAlert(event: SecurityEvent): void {
    // 发送到告警系统
    alertService.send({
      title: `Security Alert: ${event.type}`,
      message: JSON.stringify(event.details),
      severity: event.severity,
      timestamp: event.timestamp
    });
  }
}
```

### 实时威胁检测

```typescript
class ThreatDetector {
  private static suspiciousPatterns = [
    /union\s+select/i,           // SQL注入
    /<script[^>]*>/i,            // XSS
    /\.\.[\/\\]/,                // 路径遍历
    /[;&|`$()]/,                // 命令注入
    /curl|wget|nc|netcat/i,       // 可疑工具
    /sqlmap|nikto|nmap/i           // 扫描工具
  ];

  static detectThreats(input: string, context: {
    ip: string;
    userAgent?: string;
    url: string;
    method: string;
  }): { threats: string[]; severity: 'low' | 'medium' | 'high' | 'critical' } {
    const threats: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(input)) {
        threats.push(`Suspicious pattern detected: ${pattern.source}`);
        severity = 'high';
      }
    }

    // 检查可疑用户代理
    if (context.userAgent) {
      const suspiciousUA = /sqlmap|nikto|nmap|burp|zap/i;
      if (suspiciousUA.test(context.userAgent)) {
        threats.push('Suspicious user agent detected');
        severity = 'medium';
      }
    }

    return { threats, severity };
  }
}
```

---

## 🔧 运维安全

### 部署安全检查清单

#### 部署前检查

```bash
#!/bin/bash
# security-checklist.sh

echo "🔍 开始安全部署检查..."

# 1. 环境变量检查
echo "检查环境变量配置..."
if [ -z "$TOKEN_SECRET" ]; then
  echo "❌ TOKEN_SECRET未配置"
  exit 1
fi

if [ ${#TOKEN_SECRET} -lt 32 ]; then
  echo "❌ TOKEN_SECRET长度不足（${#TOKEN_SECRET} < 32）"
  exit 1
fi

# 2. 证书检查
echo "检查SSL证书..."
if [ ! -f "/path/to/cert.pem" ]; then
  echo "❌ SSL证书文件不存在"
  exit 1
fi

# 3. 权限检查
echo "检查文件权限..."
find . -name "*.env" -type f -not -perm 600 -exec echo "❌ 权限过松: {}" \;

# 4. 依赖安全扫描
echo "扫描依赖漏洞..."
pnpm audit --audit-level high
if [ $? -ne 0 ]; then
  echo "❌ 发现高危依赖漏洞"
  exit 1
fi

# 5. 安全配置测试
echo "测试安全配置..."
node -e "
const { SecureJWT } = require('./dist/utils/secureJwt');
const validation = SecureJWT.validateConfiguration();
if (!validation.valid) {
  console.log('❌ JWT配置验证失败:', validation.errors);
  process.exit(1);
}
console.log('✅ 安全配置验证通过');
"

echo "✅ 安全部署检查完成"
```

#### 监控配置

```yaml
# monitoring/docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-storage:/var/lib/grafana

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
```

### 备份安全

```typescript
class SecureBackup {
  private static encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;

  static async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString();
    const backupData = {
      timestamp,
      database: await this.exportDatabase(),
      config: this.exportSecureConfig(),
      version: '1.0.0'
    };

    // 加密备份数据
    const encrypted = DataEncryption.encrypt(
      JSON.stringify(backupData),
      this.encryptionKey
    );

    // 存储加密备份
    const backupPath = `./backups/backup-${timestamp}.enc`;
    await fs.promises.writeFile(backupPath, JSON.stringify(encrypted));

    return backupPath;
  }

  static async restoreBackup(backupPath: string): Promise<void> {
    const encryptedData = JSON.parse(
      await fs.promises.readFile(backupPath, 'utf-8')
    );

    // 解密备份数据
    const decrypted = DataEncryption.decrypt(encryptedData, this.encryptionKey);
    const backupData = JSON.parse(decrypted);

    // 恢复数据库
    await this.importDatabase(backupData.database);

    // 恢复配置
    this.importSecureConfig(backupData.config);
  }
}
```

---

## 🚨 应急响应

### 安全事件响应流程

#### 1. 事件检测与分类

```typescript
class SecurityIncident {
  constructor(
    public id: string,
    public type: SecurityEventType,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public description: string,
    public affectedSystems: string[],
    public detectedAt: Date
  ) {}

  classify(): {
    responseLevel: 'monitor' | 'investigate' | 'contain' | 'eradicate';
    responseTime: number; // 分钟
    escalationRequired: boolean;
  } {
    const responseMatrix = {
      low: { responseLevel: 'monitor', responseTime: 60, escalationRequired: false },
      medium: { responseLevel: 'investigate', responseTime: 30, escalationRequired: false },
      high: { responseLevel: 'contain', responseTime: 15, escalationRequired: true },
      critical: { responseLevel: 'eradicate', responseTime: 5, escalationRequired: true }
    };

    return responseMatrix[this.severity];
  }
}
```

#### 2. 自动化响应

```typescript
class SecurityResponseSystem {
  private static incidentHandlers = new Map<SecurityEventType, Function>();

  static registerHandler(eventType: SecurityEventType, handler: Function): void {
    this.incidentHandlers.set(eventType, handler);
  }

  static async handleIncident(incident: SecurityIncident): Promise<void> {
    const { responseLevel, escalationRequired } = incident.classify();

    // 记录事件
    SecurityLogger.log({
      type: incident.type,
      ip: incident.ip || 'unknown',
      details: {
        incidentId: incident.id,
        description: incident.description,
        affectedSystems: incident.affectedSystems,
        responseLevel
      },
      timestamp: incident.detectedAt,
      severity: incident.severity
    });

    // 执行自动响应
    const handler = this.incidentHandlers.get(incident.type);
    if (handler) {
      await handler(incident);
    }

    // 升级处理
    if (escalationRequired) {
      await this.escalateIncident(incident);
    }

    // 生成报告
    await this.generateIncidentReport(incident);
  }

  private static async escalateIncident(incident: SecurityIncident): Promise<void> {
    const escalationMessage = `
      🚨 SECURITY INCIDENT ESCALATION 🚨

      Type: ${incident.type}
      Severity: ${incident.severity}
      Description: ${incident.description}
      Affected Systems: ${incident.affectedSystems.join(', ')}
      Detected: ${incident.detectedAt.toISOString()}

      Immediate action required!
    `;

    // 发送告警
    await alertService.sendCriticalAlert('Security Incident Escalation', escalationMessage);

    // 通知安全团队
    await notificationService.notifySecurityTeam(escalationMessage);
  }
}

// 注册自动响应处理器
SecurityResponseSystem.registerHandler(
  SecurityEventType.MALICIOUS_REQUEST,
  async (incident: SecurityIncident) => {
    // 阻止恶意IP
    await firewallService.blockIP(incident.ip);

    // 增加监控
    await monitoringService.increaseMonitoringLevel(incident.ip);

    // 通知用户（如果适用）
    if (incident.userId) {
      await userService.sendSecurityAlert(incident.userId, incident.type);
    }
  }
);
```

### 事件报告模板

```markdown
# 安全事件报告

## 事件概述
- **事件ID**: ${incident.id}
- **事件类型**: ${incident.type}
- **严重程度**: ${incident.severity}
- **检测时间**: ${incident.detectedAt}
- **响应时间**: ${responseTime}

## 事件详情
- **描述**: ${incident.description}
- **受影响系统**: ${incident.affectedSystems.join(', ')}
- **攻击源**: ${attackSource}
- **攻击向量**: ${attackVector}

## 影响评估
- **业务影响**: ${businessImpact}
- **数据影响**: ${dataImpact}
- **用户影响**: ${userImpact}
- **财务影响**: ${financialImpact}

## 响应措施
- **立即行动**: ${immediateActions}
- **遏制措施**: ${containmentActions}
- **恢复措施**: ${recoveryActions}
- **预防措施**: ${preventionActions}

## 时间线
1. **检测**: ${detectionTime}
2. **响应**: ${responseTime}
3. **遏制**: ${containmentTime}
4. **恢复**: ${recoveryTime}
5. **报告**: ${reportTime}

## 根因分析
- **直接原因**: ${rootCause}
- **根本原因**: ${underlyingCause}
- **促成因素**: ${contributingFactors}

## 经验教训
- ${lessonsLearned}

## 改进建议
1. ${recommendation1}
2. ${recommendation2}
3. ${recommendation3}

---

## 📚 参考资源

### 安全标准
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)

### 工具和服务
- **依赖扫描**: `pnpm audit`, `snyk`, `npm audit`
- **代码分析**: SonarQube, CodeQL
- **渗透测试**: OWASP ZAP, Burp Suite
- **监控**: Prometheus, Grafana, ELK Stack

### 培训资源
- [OWASP Security Awareness](https://owasp.org/www-project-security-awareness/)
- [SANS Security Training](https://www.sans.org/cyber-security-training/)

---

## 📞 联系信息

如有安全相关问题，请联系：

- **安全团队**: security@llmchat.com
- **紧急响应**: security-emergency@llmchat.com
- **技术支持**: support@llmchat.com

---

**文档维护**: 本文档应定期更新以反映最新的安全实践和威胁情报。

**最后审查**: 2025年10月18日