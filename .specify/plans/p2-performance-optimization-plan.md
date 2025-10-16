# P2性能优化计划 - Phase 2.7

**创建时间**: 2025-10-16 22:20
**状态**: 🔄 执行中
**目标**: 性能提升30%+，响应时间<100ms

## 📋 优化目标

### 当前性能基准
- API响应时间: 150-300ms (平均)
- 数据库查询: 50-200ms
- 缓存命中率: 未统计
- 并发处理: 基础支持

### 目标性能
- API响应时间: <100ms (平均)
- 数据库查询: <50ms
- 缓存命中率: >80%
- 并发处理: 优化支持

## 🔧 优化任务

### Phase 2.7.1: 数据库查询优化

#### 任务1: 添加关键索引
**优先级**: High | **时间**: 30分钟

**需要添加的索引**:

1. **chat_sessions表**:
```sql
-- 用户ID索引（用于获取用户所有会话）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id 
ON chat_sessions(user_id);

-- 智能体ID索引（用于按智能体筛选）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id 
ON chat_sessions(agent_id);

-- 更新时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at 
ON chat_sessions(updated_at DESC);

-- 组合索引（用户+智能体+时间）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_agent_time 
ON chat_sessions(user_id, agent_id, updated_at DESC);

-- 标题全文搜索索引
CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_gin 
ON chat_sessions USING gin(to_tsvector('simple', title));
```

2. **chat_messages表**:
```sql
-- 会话ID索引（用于获取会话消息）
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id 
ON chat_messages(session_id);

-- 创建时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
ON chat_messages(created_at DESC);

-- 组合索引（会话+时间）
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time 
ON chat_messages(session_id, created_at DESC);

-- 消息内容全文搜索索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_gin 
ON chat_messages USING gin(to_tsvector('simple', content));
```

3. **users表**:
```sql
-- 用户名索引（用于登录查询）
CREATE INDEX IF NOT EXISTS idx_users_username 
ON users(username);

-- Email索引（用于邮箱查询）
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- 状态索引（用于过滤活跃用户）
CREATE INDEX IF NOT EXISTS idx_users_status 
ON users(status);
```

4. **agent_configs表**:
```sql
-- is_active索引（用于获取活跃智能体）
CREATE INDEX IF NOT EXISTS idx_agent_configs_is_active 
ON agent_configs(is_active);

-- 提供商类型索引
CREATE INDEX IF NOT EXISTS idx_agent_configs_provider 
ON agent_configs(provider);
```

**预期效果**:
- 会话列表查询: 100ms → 20ms (80%提升)
- 消息查询: 80ms → 15ms (81%提升)
- 搜索查询: 200ms → 30ms (85%提升)

#### 任务2: 查询优化
**优先级**: High | **时间**: 40分钟

**优化项**:

1. **避免N+1查询**:
```typescript
// ❌ 不好：N+1查询
const sessions = await getSessions(userId);
for (const session of sessions) {
  session.messageCount = await getMessageCount(session.id);
}

// ✅ 优化：使用JOIN或子查询
const sessions = await pool.query(`
  SELECT 
    s.*,
    COUNT(m.id) as message_count
  FROM chat_sessions s
  LEFT JOIN chat_messages m ON m.session_id = s.id
  WHERE s.user_id = $1
  GROUP BY s.id
  ORDER BY s.updated_at DESC
`, [userId]);
```

2. **使用LIMIT和OFFSET分页**:
```typescript
// 限制返回数量，避免大量数据传输
SELECT * FROM chat_sessions
WHERE user_id = $1
ORDER BY updated_at DESC
LIMIT 20 OFFSET 0
```

3. **仅查询需要的字段**:
```typescript
// ❌ 不好：查询所有字段
SELECT * FROM chat_sessions

// ✅ 优化：只查询需要的字段
SELECT id, title, agent_id, updated_at 
FROM chat_sessions
```

#### 任务3: 连接池参数优化
**优先级**: Medium | **时间**: 20分钟

**当前配置**:
```typescript
max: 50,  // 最大连接数
min: 10,  // 最小连接数
idleTimeoutMillis: 30_000,
connectionTimeoutMillis: 5000,
```

**优化方案**:
```typescript
max: parseInt(process.env.DB_POOL_MAX || '100'),  // 提升到100
min: parseInt(process.env.DB_POOL_MIN || '20'),   // 提升到20
idleTimeoutMillis: 60_000,  // 增加到60秒
connectionTimeoutMillis: 3000,  // 减少到3秒（快速失败）
query_timeout: 10000,  // 增加查询超时到10秒
statement_timeout: 10000,  // SQL语句超时
```

### Phase 2.7.2: 缓存策略优化

#### 任务4: 智能体列表缓存
**优先级**: High | **时间**: 25分钟

**缓存策略**:
```typescript
// 智能体列表 - 5分钟TTL
const agents = await cacheService.getOrSet(
  'agents:list:active',
  async () => await getActiveAgents(),
  300 // 5分钟
);

// 单个智能体 - 10分钟TTL
const agent = await cacheService.getOrSet(
  `agent:${agentId}`,
  async () => await getAgent(agentId),
  600 // 10分钟
);
```

**预期效果**:
- 智能体列表: 80ms → 5ms (94%提升)
- 缓存命中率: >85%

#### 任务5: 会话列表缓存
**优先级**: Medium | **时间**: 30分钟

**缓存策略**:
```typescript
// 用户会话列表 - 1分钟TTL（频繁更新）
const sessions = await cacheService.getOrSet(
  `user:${userId}:sessions`,
  async () => await getUserSessions(userId),
  60 // 1分钟
);

// 失效策略：创建/更新/删除会话时清除缓存
await cacheService.del(`user:${userId}:sessions`);
```

#### 任务6: 消息缓存
**优先级**: Medium | **时间**: 25分钟

**缓存策略**:
```typescript
// 会话最近消息 - 30秒TTL
const messages = await cacheService.getOrSet(
  `session:${sessionId}:messages:recent`,
  async () => await getRecentMessages(sessionId, 50),
  30 // 30秒
);
```

### Phase 2.7.3: 查询性能提升

#### 任务7: 批量加载优化
**优先级**: Medium | **时间**: 35分钟

**优化DataLoader模式**:
```typescript
// 批量加载智能体信息
class AgentDataLoader {
  private batchGetAgents(ids: string[]) {
    return pool.query(
      'SELECT * FROM agent_configs WHERE id = ANY($1)',
      [ids]
    );
  }
}
```

#### 任务8: 查询结果缓存
**优先级**: Low | **时间**: 20分钟

**实现查询缓存**:
```typescript
// 使用prepared statements
const statement = await pool.query({
  name: 'get-user-sessions',
  text: 'SELECT * FROM chat_sessions WHERE user_id = $1',
  values: [userId],
});
```

## 📊 预期成果

### 性能提升目标

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| API响应时间 | 200ms | <100ms | 50%+ |
| 数据库查询 | 100ms | <50ms | 50%+ |
| 缓存命中率 | 未知 | >80% | 新增 |
| 并发处理 | 100 req/s | 500 req/s | 400%+ |

### 时间预算
- 数据库优化: 90分钟
- 缓存优化: 80分钟
- 查询优化: 55分钟
- **总计**: ~225分钟

---

**计划创建**: 2025-10-16 22:20  
**执行开始**: 立即开始

