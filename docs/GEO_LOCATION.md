# IP 地理位置功能

## 概述

LLMChat 使用 `geoip-lite` 库实现 IP 地理位置解析，支持将用户 IP 地址转换为**国家、省份、城市**信息，用于数据分析和用户行为追踪。

## 功能特性

### 1. 完整的中国省份支持

支持所有 **34 个省级行政区**（含直辖市、自治区、特别行政区）：

| 省份 | 关键词示例 |
|------|-----------|
| 北京 | beijing, bj, 110000 |
| 广东 | guangdong, gd, 440000 |
| 上海 | shanghai, sh, 310000 |
| 四川 | sichuan, sc, 510000 |
| ... | ... |

**完整列表**: 参见 `GeoService.ts` 中的 `PROVINCE_MAPPINGS`

### 2. 智能地址解析

- **私有IP处理**: 10.x.x.x, 192.168.x.x → 显示为 "本地"
- **海外IP处理**: 非中国IP → 显示为 "海外" + 国家代码
- **未知IP处理**: 无法解析的IP → 显示为 "未知"
- **代理IP处理**: 自动提取 X-Forwarded-For 中的真实IP

### 3. 多种输入格式支持

```typescript
// 支持的IP格式
'192.168.1.1'                    // 标准IPv4
'::ffff:192.168.1.1'            // IPv6映射的IPv4
'123.456.789.0, 192.168.1.1'   // 逗号分隔（取第一个）
['123.456.789.0', '192.168.1.1'] // 数组（取第一个）
```

## 使用方法

### 基础用法

```typescript
import { geoService } from '@/services/GeoService';

// 解析IP地址
const result = geoService.lookup('123.125.114.144');

console.log(result);
// 输出:
// {
//   country: 'CN',
//   province: '北京',
//   city: 'Beijing'
// }
```

### 在 Controller 中使用

```typescript
import { Request, Response } from 'express';
import { geoService } from '@/services/GeoService';

export class ChatController {
  async handleMessage(req: Request, res: Response) {
    // 获取真实IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // 解析地理位置
    const geo = geoService.lookup(clientIp);
    
    if (geo) {
      console.log(`用户来自: ${geo.country} - ${geo.province} - ${geo.city || '未知城市'}`);
      
      // 记录到数据库
      await this.recordGeoEvent(req.params.agentId, geo, clientIp);
    }
    
    // ... 业务逻辑
  }
  
  private async recordGeoEvent(agentId: string, geo: any, ip: string) {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO chat_geo_events (id, agent_id, ip, country, province, city, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          generateId(),
          agentId,
          ip,
          geo.country,
          geo.province,
          geo.city
        ]
      );
    });
  }
}
```

### 在 Express 中间件中使用

```typescript
// backend/src/middleware/geoMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { geoService } from '@/services/GeoService';

export function geoEnrichmentMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = geoService.lookup(clientIp);
    
    // 将地理信息附加到请求对象
    (req as any).geo = geo;
    
    next();
  };
}

// 使用
import { geoEnrichmentMiddleware } from '@/middleware/geoMiddleware';
app.use('/api', geoEnrichmentMiddleware());

// 在任何路由中访问
app.get('/api/some-route', (req, res) => {
  const geo = (req as any).geo;
  console.log(geo.province); // 广东
});
```

## 数据存储

### 地理事件表结构

```sql
CREATE TABLE chat_geo_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT,
  ip TEXT,
  country TEXT,
  province TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 写入示例

```typescript
import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';

async function recordGeoEvent(
  agentId: string,
  sessionId: string | null,
  ip: string,
  geo: { country: string; province: string; city: string | null }
) {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO chat_geo_events (id, agent_id, session_id, ip, country, province, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [generateId(), agentId, sessionId, ip, geo.country, geo.province, geo.city]
    );
  });
}
```

### 查询示例

```typescript
// 查询广东省的访问记录
const result = await pool.query(
  `SELECT agent_id, COUNT(*) as count
   FROM chat_geo_events
   WHERE province = '广东'
   GROUP BY agent_id
   ORDER BY count DESC`
);

// 查询最近24小时的地理分布
const distribution = await pool.query(
  `SELECT country, province, city, COUNT(*) as count
   FROM chat_geo_events
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY country, province, city
   ORDER BY count DESC
   LIMIT 20`
);
```

## 数据分析集成

### 地理分布统计视图

使用 `v_geo_distribution_stats` 视图（已在 008 迁移脚本中创建）：

```typescript
// GET /api/admin/analytics/geo
async function getGeoDistribution(req: Request, res: Response) {
  const result = await pool.query(`
    SELECT 
      country,
      province,
      city,
      event_count,
      agents_used,
      unique_sessions,
      last_event_at
    FROM v_geo_distribution_stats
    ORDER BY event_count DESC
    LIMIT 50
  `);
  
  res.json({
    success: true,
    data: result.rows
  });
}
```

### 前端展示

```typescript
// 使用 ECharts 地图可视化
import * as echarts from 'echarts';

// 获取地理分布数据
const response = await fetch('/api/admin/analytics/geo');
const { data } = await response.json();

// 转换为 ECharts 格式
const mapData = data
  .filter(item => item.country === 'CN')  // 仅中国数据
  .map(item => ({
    name: item.province,
    value: item.event_count
  }));

// 配置地图
const option = {
  title: {
    text: '用户地理分布',
    left: 'center'
  },
  tooltip: {
    trigger: 'item',
    formatter: '{b}<br/>访问量: {c}'
  },
  visualMap: {
    min: 0,
    max: 1000,
    text: ['高', '低'],
    realtime: false,
    calculable: true,
    inRange: {
      color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695']
    }
  },
  series: [{
    name: '访问量',
    type: 'map',
    map: 'china',
    label: {
      show: true
    },
    data: mapData
  }]
};

// 渲染
const chart = echarts.init(document.getElementById('map'));
chart.setOption(option);
```

## 测试

### 单元测试

```typescript
// backend/src/__tests__/services/GeoService.test.ts
import { geoService } from '@/services/GeoService';

describe('GeoService', () => {
  describe('normalizeIp', () => {
    test('标准 IPv4', () => {
      expect(geoService.normalizeIp('192.168.1.1')).toBe('192.168.1.1');
    });
    
    test('IPv6 映射的 IPv4', () => {
      expect(geoService.normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
    });
    
    test('逗号分隔多个IP', () => {
      expect(geoService.normalizeIp('123.125.114.144, 192.168.1.1')).toBe('123.125.114.144');
    });
    
    test('数组格式', () => {
      expect(geoService.normalizeIp(['123.125.114.144', '192.168.1.1'] as any)).toBe('123.125.114.144');
    });
    
    test('空值处理', () => {
      expect(geoService.normalizeIp(null)).toBeNull();
      expect(geoService.normalizeIp(undefined)).toBeNull();
      expect(geoService.normalizeIp('')).toBeNull();
    });
  });
  
  describe('lookup', () => {
    test('北京 IP 解析', () => {
      // 使用真实的北京IP地址（示例）
      const result = geoService.lookup('123.125.114.144');
      expect(result).toMatchObject({
        country: 'CN',
        province: '北京'
      });
    });
    
    test('广东 IP 解析', () => {
      // 使用真实的广东IP地址（示例）
      const result = geoService.lookup('14.215.177.38');
      expect(result).toMatchObject({
        country: 'CN',
        province: '广东'
      });
    });
    
    test('私有 IP 处理', () => {
      expect(geoService.lookup('192.168.1.1')).toMatchObject({
        country: 'LOCAL',
        province: '本地',
        city: null
      });
      
      expect(geoService.lookup('10.0.0.1')).toMatchObject({
        country: 'LOCAL',
        province: '本地'
      });
      
      expect(geoService.lookup('127.0.0.1')).toMatchObject({
        country: 'LOCAL',
        province: '本地'
      });
    });
    
    test('海外 IP 处理', () => {
      // 美国 IP（示例: Google DNS）
      const result = geoService.lookup('8.8.8.8');
      expect(result).toMatchObject({
        country: 'US',
        province: '海外'
      });
    });
    
    test('无效 IP 处理', () => {
      const result = geoService.lookup('999.999.999.999');
      expect(result).toMatchObject({
        country: 'UNKNOWN',
        province: '未知'
      });
    });
  });
  
  describe('getProvinceNames', () => {
    test('返回所有省份名称', () => {
      const provinces = geoService.getProvinceNames();
      
      expect(provinces).toContain('北京');
      expect(provinces).toContain('广东');
      expect(provinces).toContain('上海');
      expect(provinces).toContain('新疆');
      expect(provinces.length).toBe(34); // 34个省级行政区
    });
  });
});
```

### 集成测试

```typescript
// backend/src/__tests__/integration/geo-recording.test.ts
import request from 'supertest';
import { app } from '@/index';
import { getPool } from '@/utils/db';

describe('地理位置记录集成测试', () => {
  afterEach(async () => {
    // 清理测试数据
    await getPool().query('DELETE FROM chat_geo_events WHERE agent_id LIKE $1', ['test-%']);
  });
  
  test('聊天请求应记录地理位置', async () => {
    const response = await request(app)
      .post('/api/chat/completions')
      .set('X-Forwarded-For', '123.125.114.144')  // 北京IP
      .send({
        agentId: 'test-agent',
        messages: [{ role: 'user', content: '你好' }]
      });
    
    expect(response.status).toBe(200);
    
    // 验证地理事件已记录
    const result = await getPool().query(
      'SELECT * FROM chat_geo_events WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1',
      ['test-agent']
    );
    
    expect(result.rows[0]).toMatchObject({
      country: 'CN',
      province: '北京'
    });
  });
});
```

## 性能优化

### 1. 缓存策略

```typescript
import { LRUCache } from 'lru-cache';

export class CachedGeoService extends GeoService {
  private cache: LRUCache<string, GeoLookupResult | null>;
  
  constructor() {
    super();
    this.cache = new LRUCache({
      max: 10000,        // 最多缓存 10000 个IP
      ttl: 1000 * 60 * 60 // 1小时过期
    });
  }
  
  lookup(ip: string | null | undefined): GeoLookupResult | null {
    if (!ip) return null;
    
    const normalized = this.normalizeIp(ip);
    if (!normalized) return null;
    
    // 检查缓存
    if (this.cache.has(normalized)) {
      return this.cache.get(normalized)!;
    }
    
    // 查询并缓存
    const result = super.lookup(normalized);
    this.cache.set(normalized, result);
    
    return result;
  }
}

export const cachedGeoService = new CachedGeoService();
```

### 2. 批量写入

```typescript
// 批量写入地理事件（提升性能）
class GeoEventBatcher {
  private queue: any[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  add(event: any) {
    this.queue.push(event);
    
    // 每100条或每秒批量写入
    if (this.queue.length >= 100) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 1000);
    }
  }
  
  private async flush() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.queue.length);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    // 批量插入
    await withClient(async (client) => {
      const values = batch.map((e, i) => 
        `($${i*7+1}, $${i*7+2}, $${i*7+3}, $${i*7+4}, $${i*7+5}, $${i*7+6}, $${i*7+7})`
      ).join(', ');
      
      const params = batch.flatMap(e => [
        e.id, e.agent_id, e.session_id, e.ip, e.country, e.province, e.city
      ]);
      
      await client.query(
        `INSERT INTO chat_geo_events (id, agent_id, session_id, ip, country, province, city, created_at)
         VALUES ${values}`,
        params
      );
    });
  }
}
```

## 故障排查

### 问题1: IP 解析返回 null

**原因**: 
- IP 格式不正确
- IP 是私有地址
- geoip-lite 数据库缺失

**解决方案**:
```bash
# 检查 geoip-lite 数据
cd node_modules/geoip-lite
ls -la data/

# 更新 geoip-lite 数据
npm update geoip-lite

# 强制重新加载数据
import geoip from 'geoip-lite';
geoip.reloadData();
```

### 问题2: 省份显示为"未知"

**原因**: 
- geoip-lite 返回的 region 字段与省份映射不匹配

**解决方案**:
- 查看实际返回的 region 值，添加到 `PROVINCE_MAPPINGS`

```typescript
// 调试代码
const record = geoip.lookup('YOUR_IP');
console.log('Region:', record?.region);
console.log('City:', record?.city);

// 然后更新映射
{ 
  name: '目标省份', 
  keywords: ['新的region值', '新的city值'] 
}
```

## 隐私与合规

### GDPR 合规

- IP 地址被视为个人数据
- 用户有权请求删除其 IP 记录
- 建议定期清理旧的地理事件数据（如 90 天）

### 数据清理脚本

```sql
-- 删除 90 天前的地理事件
DELETE FROM chat_geo_events
WHERE created_at < NOW() - INTERVAL '90 days';

-- 或者软删除（推荐）
ALTER TABLE chat_geo_events ADD COLUMN deleted_at TIMESTAMPTZ;

UPDATE chat_geo_events
SET deleted_at = NOW()
WHERE created_at < NOW() - INTERVAL '90 days'
  AND deleted_at IS NULL;
```

---

**文档版本**: 1.0  
**最后更新**: 2025-10-02  
**维护者**: LLMChat 开发团队

