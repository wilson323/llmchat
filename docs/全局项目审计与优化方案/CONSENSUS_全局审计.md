# 共识文档 - 全局项目审计与优化

## 明确的需求描述

基于现有 llmchat 项目,系统性地识别、分类和解决以下四类问题:

1. **待办事项**: 已规划但未完成的功能和任务
2. **可优化内容**: 现有功能的性能、体验、代码质量提升
3. **企业级改进**: 安全、稳定性、可观测性、合规性等生产级要求
4. **技术债务清理**: 模拟数据、类型安全、代码重复等问题

目标是将项目从**MVP 原型**提升到**企业级生产就绪**状态。

## 验收标准

### 核心指标

| 维度 | 当前状态 | 目标状态 | 验收标准 |
|------|----------|----------|----------|
| **安全性** | ❌ 明文密码、硬编码密钥 | ✅ 加密存储、环境变量化 | 通过安全审计,无高危漏洞 |
| **测试覆盖** | ❌ <10% | ✅ >80% | 单元测试 + 集成测试覆盖核心流程 |
| **类型安全** | ⚠️ 357 处 any | ✅ <50 处 any | 高风险文件 100% 修复 |
| **日志规范** | ❌ console.* 172 处 | ✅ 结构化日志 | 统一日志框架,生产可查询 |
| **性能** | ⚠️ 部分卡顿 | ✅ 流畅体验 | 首屏 <2s,页面切换 <300ms |
| **可观测性** | ⚠️ 基础设施存在 | ✅ 完整监控 | 日志/指标/追踪全覆盖 |
| **稳定性** | ⚠️ 基础容错 | ✅ 生产级弹性 | 熔断/限流/重试/降级 |

## 技术实现方案

### 1. 安全加固方案 (P0)

#### 1.1 密码加密存储

**当前问题**:
- `users` 表包含 `password_plain` 列
- `AuthService` 使用明文比对密码

**解决方案**:
```typescript
// backend/src/services/AuthService.ts 重构
import bcrypt from 'bcrypt';

// 1. 删除明文密码列
ALTER TABLE users DROP COLUMN IF EXISTS password_plain;

// 2. 使用 bcrypt 散列
async hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return { salt, hash };
}

async verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 3. 补充密码强度策略
validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('密码长度至少 8 位');
  if (!/[A-Z]/.test(password)) errors.push('至少包含一个大写字母');
  if (!/[a-z]/.test(password)) errors.push('至少包含一个小写字母');
  if (!/[0-9]/.test(password)) errors.push('至少包含一个数字');
  return { valid: errors.length === 0, errors };
}
```

**依赖**: `bcrypt` (已在其他企业项目中使用)

**迁移计划**:
1. 添加迁移脚本,为现有用户生成散列
2. 部署新代码,强制下次登录时重置密码
3. 删除 `password_plain` 列

#### 1.2 敏感信息环境变量化

**当前问题**:
- `config/agents.json` 包含真实 API Key
- 硬编码的数据库凭证

**解决方案**:
```typescript
// backend/.env.example 补充
# Agent API Keys (运行时注入)
FASTGPT_API_KEY=your-fastgpt-api-key
OPENAI_API_KEY=your-openai-api-key
DASHSCOPE_API_KEY=your-dashscope-api-key

# Database (敏感)
DB_PASSWORD=secure-password

// backend/src/services/AgentConfigService.ts
loadAgents(): AgentConfig[] {
  const agents = readFromDB();
  return agents.map(agent => ({
    ...agent,
    apiKey: process.env[`${agent.id.toUpperCase()}_API_KEY`] || agent.apiKey
  }));
}
```

**配套措施**:
- `.gitignore` 已包含 `.env` 文件
- 提供 `config/agents.example.json` 作为模板
- 部署文档说明环境变量注入方式

### 2. 日志系统改造 (P0)

#### 2.1 引入 Winston 结构化日志

**依赖**: `winston`, `winston-daily-rotate-file`

**实现**:
```typescript
// backend/src/utils/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'llmchat-backend' },
  transports: [
    new DailyRotateFile({
      filename: 'backend/log/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'backend/log/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
```

**替换策略**:
```typescript
// 全局替换
console.log()   → logger.info()
console.error() → logger.error()
console.warn()  → logger.warn()
console.debug() → logger.debug()

// 添加上下文
logger.info('Agent loaded', {
  agentId,
  provider,
  endpoint,
  timestamp: new Date().toISOString()
});
```

### 3. Token 持久化方案 (P0)

#### 方案选择

**选项 1: Redis 存储 (推荐)**
- 优点: 支持分布式,自动过期,性能好
- 缺点: 需要额外部署 Redis

**选项 2: JWT 无状态 (备选)**
- 优点: 无需存储,天然分布式
- 缺点: 无法主动撤销,payload 暴露

**推荐方案: Redis + JWT 混合**
```typescript
// backend/src/services/TokenService.ts
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  exp: number;
}

class TokenService {
  private redis: Redis;
  private secret = process.env.JWT_SECRET!;
  private ttl = 7 * 24 * 3600; // 7 天

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'token:'
    });
  }

  async createToken(userId: string, username: string, role: string): Promise<string> {
    const payload: TokenPayload = {
      userId,
      username,
      role,
      exp: Math.floor(Date.now() / 1000) + this.ttl
    };
    
    const token = jwt.sign(payload, this.secret);
    
    // 存储到 Redis (支持主动撤销)
    await this.redis.setex(`user:${userId}`, this.ttl, token);
    
    return token;
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = jwt.verify(token, this.secret) as TokenPayload;
      
      // 检查是否已撤销
      const stored = await this.redis.get(`user:${payload.userId}`);
      if (stored !== token) {
        return null; // Token 已撤销或过期
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  async revokeToken(userId: string): Promise<void> {
    await this.redis.del(`user:${userId}`);
  }
}
```

**部署要求**:
- 开发环境: 本地 Redis 实例
- 生产环境: Redis 集群或云服务(如 AWS ElastiCache)

### 4. 测试覆盖提升 (P0)

#### 4.1 后端测试策略

**目标**: 核心服务 >80% 覆盖率

**优先级**:
1. **P0**: `AuthService`, `AgentConfigService`, `ChatProxyService`
2. **P1**: Controllers, Middleware
3. **P2**: Utils, Helpers

**示例: AgentConfigService 测试**
```typescript
// backend/src/__tests__/AgentConfigService.enhanced.test.ts
import { AgentConfigService } from '@/services/AgentConfigService';
import { getPool } from '@/utils/db';

jest.mock('@/utils/db');

describe('AgentConfigService', () => {
  let service: AgentConfigService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn()
    };
    (getPool as jest.Mock).mockReturnValue(mockPool);
    service = new AgentConfigService();
  });

  describe('loadAgents', () => {
    it('应从数据库加载智能体', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'test', name: 'Test Agent', is_active: true }]
      });

      const agents = await service.loadAgents();
      
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('test');
    });

    it('数据库为空时应返回内置种子', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      const agents = await service.loadAgents();
      
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].name).toContain('示例');
    });
  });

  describe('createAgent', () => {
    it('应拒绝无效的配置', async () => {
      await expect(
        service.createAgent({ id: '', name: '', endpoint: '' } as any)
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('应防止ID冲突', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
      
      await expect(
        service.createAgent({ id: 'existing', name: 'Test', endpoint: 'http://test' } as any)
      ).rejects.toThrow('CONFLICT');
    });
  });
});
```

#### 4.2 前端测试策略

**工具链**: Vitest + Testing Library

**实现步骤**:
1. 安装依赖
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "vitest": "^1.0.0"
  }
}
```

2. 配置 `frontend/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      threshold: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

3. 核心组件测试示例
```typescript
// frontend/src/components/chat/__tests__/MessageItem.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageItem } from '../MessageItem';

describe('MessageItem', () => {
  const mockMessage = {
    id: '1',
    role: 'assistant' as const,
    content: 'Hello, world!',
    timestamp: Date.now()
  };

  it('应正确渲染消息内容', () => {
    render(<MessageItem message={mockMessage} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('应支持点赞操作', async () => {
    const onFeedback = jest.fn();
    render(<MessageItem message={mockMessage} onFeedback={onFeedback} />);
    
    const likeButton = screen.getByRole('button', { name: /点赞/i });
    fireEvent.click(likeButton);
    
    expect(onFeedback).toHaveBeenCalledWith(mockMessage.id, 'like');
  });
});
```

### 5. 模拟数据清理 (P0)

#### 识别的模拟数据

| 文件 | 类型 | 清理方案 |
|------|------|----------|
| `SLADashboard.tsx` | 监控数据 | 实现真实 API `/api/monitoring/sla` |
| `AgentDetails.tsx` | 智能体指标 | 对接 `MonitoringService` |
| `useOptimisticSessionSwitch.ts` | 会话数据 | 对接 `FastGPTSessionService` |

**统一清理策略**:
```typescript
// 1. 所有模拟数据生成函数添加 @deprecated 标记
/**
 * @deprecated 模拟数据,待替换为真实 API
 * @see https://github.com/yourorg/llmchat/issues/123
 */
const generateMockData = () => { ... };

// 2. 实现真实 API
// backend/src/routes/monitoring.ts
router.get('/sla', monitoringController.getSLAMetrics);

// 3. 替换前端调用
const { data, loading, error } = useSWR('/api/monitoring/sla', fetcher);

// 4. 删除模拟函数代码
```

### 6. 性能优化方案 (P1)

#### 6.1 chatStore 拆分

**当前问题**: 单文件 700+ 行,状态更新频繁

**拆分方案**:
```typescript
// frontend/src/store/slices/agentSlice.ts
export const createAgentSlice = (set, get) => ({
  agents: [],
  currentAgent: null,
  setAgents: (agents) => set({ agents }),
  selectAgent: (id) => set({ currentAgent: get().agents.find(a => a.id === id) })
});

// frontend/src/store/slices/messageSlice.ts
export const createMessageSlice = (set, get) => ({
  messages: [],
  addMessage: (message) => set({ messages: [...get().messages, message] }),
  updateMessage: (id, updates) => set({
    messages: get().messages.map(m => m.id === id ? { ...m, ...updates } : m)
  })
});

// frontend/src/store/chatStore.ts
export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      ...createAgentSlice(set, get),
      ...createMessageSlice(set, get),
      ...createSessionSlice(set, get),
      ...createStreamingSlice(set, get)
    }),
    { name: 'chat-store' }
  )
);
```

#### 6.2 长列表虚拟滚动

**实现**: `react-virtual` 或 `react-window`

```typescript
// frontend/src/components/chat/VirtualMessageList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualMessageList({ messages }: { messages: ChatMessage[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 估计每条消息高度
    overscan: 5 // 预渲染 5 条
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <MessageItem message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 7. 类型安全提升 (P1)

#### 7.1 高风险文件修复

**后端优先级**:
1. `ChatProxyService.ts` (22 处 any)
2. `FastGPTSessionService.ts` (21 处)
3. `ProtectionService.ts` (19 处)

**前端优先级**:
1. `api.ts` (28 处 any)
2. `AdminHome.tsx` (16 处)
3. `HybridStorageManager.ts` (10 处)

**修复策略**:
```typescript
// 修复前
function processEvent(event: any) {
  return event.data.map((item: any) => item.value);
}

// 修复后
interface EventData {
  data: Array<{ value: string; metadata?: Record<string, unknown> }>;
}

function processEvent(event: EventData): string[] {
  return event.data.map(item => item.value);
}
```

#### 7.2 Git Hook 集成

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 类型检查
npm run type-check

# 检测新增 any
git diff --cached --name-only | grep '.ts$' | xargs grep -n ': any' && {
  echo "❌ 检测到新增 any 类型,请修复后再提交"
  exit 1
}

# ESLint
npm run lint
```

### 8. 可观测性完善 (P1)

#### 8.1 链路追踪

**引入 OpenTelemetry**:
```typescript
// backend/src/utils/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const sdk = new NodeSDK({
  serviceName: 'llmchat-backend',
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation()
  ],
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  })
});

sdk.start();
```

#### 8.2 指标采集

**Prometheus 集成**:
```typescript
// backend/src/utils/metrics.ts
import client from 'prom-client';

export const register = new client.Registry();

// 系统指标
client.collectDefaultMetrics({ register });

// 业务指标
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP 请求耗时',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10]
});

export const chatMessageCounter = new client.Counter({
  name: 'chat_messages_total',
  help: '聊天消息总数',
  labelNames: ['agent_id', 'role']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(chatMessageCounter);

// 暴露接口
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 9. 稳定性增强 (P1)

#### 9.1 熔断器集成

**使用现有 `CircuitBreakerService`**:
```typescript
// backend/src/services/ChatProxyService.ts
import { CircuitBreakerService } from './CircuitBreakerService';

class ChatProxyService {
  private breakers = new Map<string, CircuitBreakerService>();

  private getBreaker(agentId: string): CircuitBreakerService {
    if (!this.breakers.has(agentId)) {
      this.breakers.set(agentId, new CircuitBreakerService({
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenAttempts: 3
      }));
    }
    return this.breakers.get(agentId)!;
  }

  async sendMessage(agent: AgentConfig, messages: Message[]): Promise<Response> {
    const breaker = this.getBreaker(agent.id);
    
    return breaker.execute(async () => {
      // 原有请求逻辑
      const response = await axios.post(agent.endpoint, { messages });
      return response.data;
    });
  }
}
```

#### 9.2 优雅降级

```typescript
// backend/src/services/ChatProxyService.ts
async sendMessageWithFallback(
  agent: AgentConfig,
  messages: Message[]
): Promise<Response> {
  try {
    return await this.sendMessage(agent, messages);
  } catch (error) {
    logger.warn('Primary agent failed, trying fallback', { agentId: agent.id, error });
    
    // 尝试备用智能体
    const fallbackAgent = await this.getFallbackAgent(agent.id);
    if (fallbackAgent) {
      return await this.sendMessage(fallbackAgent, messages);
    }
    
    // 返回默认响应
    return {
      content: '抱歉,当前智能体暂时不可用,请稍后重试。',
      error: true
    };
  }
}
```

## 技术约束和集成方案

### 约束条件
1. **环境**: Windows 开发,Linux 生产
2. **数据库**: 必须使用 PostgreSQL,禁止 SQLite
3. **兼容性**: 保持现有 API 接口不变,渐进式升级
4. **依赖**: 优先使用项目已有的依赖,新增需评审

### 集成方案
1. **向后兼容**: 所有改动支持平滑迁移,不破坏现有功能
2. **分阶段实施**: 按 P0 → P1 → P2 → P3 顺序执行
3. **独立验证**: 每个改动独立测试,通过后才合并
4. **文档同步**: 代码变更必须更新相应文档

## 任务边界限制

### 包含范围
- ✅ 代码质量提升(类型安全、测试覆盖、代码规范)
- ✅ 安全加固(密码加密、敏感信息保护、权限控制)
- ✅ 性能优化(状态管理、渲染优化、缓存策略)
- ✅ 可观测性(日志、指标、链路追踪)
- ✅ 稳定性(熔断、限流、降级、重试)
- ✅ 模拟数据清理

### 排除范围
- ❌ 大规模功能重构(如更换框架)
- ❌ UI/UX 大改(仅优化现有交互)
- ❌ 多租户架构(当前单租户)
- ❌ 国际化全面实施(后续计划)
- ❌ 移动端原生开发

## 确认所有不确定性已解决

### 已明确的技术选型
- ✅ 日志系统: Winston
- ✅ Token 存储: Redis + JWT
- ✅ 测试框架: Jest (后端) + Vitest (前端)
- ✅ 链路追踪: OpenTelemetry
- ✅ 指标采集: Prometheus
- ✅ 密码加密: bcrypt

### 待确认的配置项
- [ ] Redis 服务器地址和端口(开发/生产)
- [ ] OpenTelemetry 导出目标(Jaeger/Zipkin/云服务)
- [ ] Prometheus 抓取配置
- [ ] 密码强度策略参数
- [ ] 测试覆盖率阈值(建议 80%)

### 风险评估
| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Redis 部署复杂 | 中 | 中 | 提供 Docker Compose,简化部署 |
| 大规模重构影响稳定性 | 高 | 高 | 渐进式改造,充分测试 |
| 测试覆盖不足 | 中 | 高 | 优先核心路径,设置覆盖率门槛 |
| 性能优化效果不明显 | 低 | 中 | 建立性能基准,量化对比 |

---

**文档状态**: 共识达成 - 待设计  
**评审人**: [待填写]  
**批准时间**: [待填写]  
**下一步**: 进入架构设计阶段(DESIGN 文档)

