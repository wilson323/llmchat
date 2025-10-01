# FastGPT会话治理扩展API使用示例

本文档提供了FastGPT会话治理扩展功能的详细API使用示例。

## 📋 基础配置

所有API请求需要：
- 基础URL: `http://localhost:3001/api/sessions`
- Content-Type: `application/json`
- 认证: Bearer Token (管理员权限操作需要)

## 🗂️ 1. 增强版会话列表查询

### 基础分页查询

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/enhanced?page=1&pageSize=20"
```

### 带过滤条件的查询

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/enhanced?page=1&pageSize=50&startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z&tags=important,customer&sortBy=updatedAt&sortOrder=desc"
```

### 关键词搜索

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/enhanced?searchKeyword=客服咨询&minMessageCount=5&maxMessageCount=100"
```

### JavaScript示例

```javascript
// 获取分页会话列表
const response = await fetch('/api/sessions/agent-123/enhanced?' + new URLSearchParams({
  page: '1',
  pageSize: '20',
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-03-31T23:59:59Z',
  tags: 'important,urgent',
  sortBy: 'updatedAt',
  sortOrder: 'desc'
}));

const result = await response.json();
console.log('会话列表:', result.data);
console.log('分页信息:', {
  total: result.data.total,
  page: result.data.page,
  pageSize: result.data.pageSize,
  totalPages: result.data.totalPages
});
```

### 响应格式

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "chatId": "chat-123",
        "appId": "app-456",
        "title": "关于产品功能的咨询",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T11:45:00Z",
        "messageCount": 12,
        "tags": ["customer", "technical"],
        "raw": {}
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2024-01-20T08:00:00Z"
}
```

## 🔄 2. 批量操作

### 批量删除会话

```bash
curl -X POST "http://localhost:3001/api/sessions/{agentId}/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "sessionIds": ["chat-123", "chat-456", "chat-789"],
    "operation": "delete"
  }'
```

### 批量添加标签

```bash
curl -X POST "http://localhost:3001/api/sessions/{agentId}/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "sessionIds": ["chat-123", "chat-456"],
    "operation": "addTags",
    "tags": ["processed", "q1-2024", "high-priority"]
  }'
```

### 批量移除标签

```bash
curl -X POST "http://localhost:3001/api/sessions/{agentId}/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "sessionIds": ["chat-123", "chat-456"],
    "operation": "removeTags",
    "tags": ["outdated"]
  }'
```

### 批量归档

```bash
curl -X POST "http://localhost:3001/api/sessions/{agentId}/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "sessionIds": ["chat-123", "chat-456", "chat-789"],
    "operation": "archive"
  }'
```

### JavaScript示例

```javascript
async function batchAddTags(agentId, sessionIds, tags) {
  const response = await fetch(`/api/sessions/${agentId}/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      sessionIds,
      operation: 'addTags',
      tags
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log(`成功操作 ${result.data.success} 个会话`);
    if (result.data.failed > 0) {
      console.log('失败的操作:', result.data.errors);
    }
  }
}

// 使用示例
await batchAddTags('agent-123', ['chat-1', 'chat-2'], ['processed', 'reviewed']);
```

### 响应格式

```json
{
  "success": true,
  "data": {
    "success": 2,
    "failed": 1,
    "errors": ["会话 chat-789 操作失败: 会话不存在"]
  },
  "timestamp": "2024-01-20T08:00:00Z"
}
```

## 📤 3. 会话导出

### 导出为JSON格式

```bash
curl -X POST "http://localhost:3001/api/sessions/{agentId}/export" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "format": "json",
    "includeMessages": true,
    "includeMetadata": true,
    "filters": {
      "tags": ["export"],
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-03-31T23:59:59Z"
    }
  }' \
  --output "sessions-export.json"
```

### 导出为CSV格式

```bash
curl -X POST "http://localhost:3001/api/sessions/{agentId}/export" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "format": "csv",
    "includeMessages": false,
    "includeMetadata": false,
    "filters": {
      "minMessageCount": 5,
      "maxMessageCount": 50
    }
  }' \
  --output "sessions-export.csv"
```

### JavaScript示例

```javascript
async function exportSessions(agentId, format, options = {}) {
  const requestBody = {
    format,
    includeMessages: options.includeMessages || false,
    includeMetadata: options.includeMetadata || false,
    filters: options.filters || {},
    dateRange: options.dateRange || undefined
  };

  const response = await fetch(`/api/sessions/${agentId}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(requestBody)
  });

  if (response.ok) {
    const blob = await response.blob();
    const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `sessions-export.${format}`;

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log(`导出完成: ${filename}`);
  } else {
    console.error('导出失败:', await response.text());
  }
}

// 使用示例
await exportSessions('agent-123', 'json', {
  includeMessages: true,
  filters: {
    tags: ['important'],
    startDate: '2024-01-01T00:00:00Z'
  }
});
```

### 导出的JSON格式示例

```json
{
  "metadata": {
    "exportedAt": "2024-01-20T08:00:00Z",
    "totalSessions": 25,
    "includeMessages": true,
    "includeMetadata": true,
    "filters": {
      "tags": ["important"]
    }
  },
  "sessions": [
    {
      "chatId": "chat-123",
      "title": "产品咨询",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:45:00Z",
      "messageCount": 12,
      "tags": ["customer", "important"],
      "messages": [
        {
          "role": "user",
          "content": "请问你们的产品支持什么功能？"
        },
        {
          "role": "assistant",
          "content": "我们的产品支持以下主要功能..."
        }
      ],
      "raw": {}
    }
  ]
}
```

## 📊 4. 会话统计信息

### 获取统计信息

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/stats?startDate=2024-01-01T00:00:00Z&endDate=2024-03-31T23:59:59Z"
```

### JavaScript示例

```javascript
const response = await fetch('/api/sessions/agent-123/stats?' + new URLSearchParams({
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-12-31T23:59:59Z'
}));

const stats = await response.json();
console.log('统计信息:', stats.data);
```

### 响应格式

```json
{
  "success": true,
  "data": {
    "totalSessions": 150,
    "totalMessages": 2340,
    "averageMessagesPerSession": 15.6,
    "topTags": [
      { "tag": "customer", "count": 45 },
      { "tag": "technical", "count": 32 },
      { "tag": "urgent", "count": 28 }
    ],
    "recentActivity": [
      { "date": "2024-01-19", "sessions": 12, "messages": 156 },
      { "date": "2024-01-18", "sessions": 8, "messages": 124 },
      { "date": "2024-01-17", "sessions": 15, "messages": 198 }
    ]
  },
  "timestamp": "2024-01-20T08:00:00Z"
}
```

## 🔍 5. 事件查询

### 查询所有事件

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/events?page=1&pageSize=50&sortOrder=desc"
```

### 按会话ID过滤

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/events?sessionIds=chat-123,chat-456&eventTypes=deleted,exported"
```

### 按时间范围过滤

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/events?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&eventTypes=created,updated"
```

### JavaScript示例

```javascript
async function querySessionEvents(agentId, filters = {}) {
  const params = new URLSearchParams({
    page: filters.page || '1',
    pageSize: filters.pageSize || '20',
    sortOrder: filters.sortOrder || 'desc'
  });

  if (filters.sessionIds) {
    params.append('sessionIds', filters.sessionIds.join(','));
  }

  if (filters.eventTypes) {
    params.append('eventTypes', filters.eventTypes.join(','));
  }

  if (filters.startDate) {
    params.append('startDate', filters.startDate);
  }

  if (filters.endDate) {
    params.append('endDate', filters.endDate);
  }

  const response = await fetch(`/api/sessions/${agentId}/events?${params}`);
  const result = await response.json();

  console.log('事件列表:', result.data.data);
  return result.data;
}

// 使用示例
const events = await querySessionEvents('agent-123', {
  eventTypes: ['deleted', 'exported'],
  startDate: '2024-01-01T00:00:00Z',
  pageSize: 50
});
```

### 响应格式

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "evt-123",
        "sessionId": "chat-456",
        "agentId": "agent-123",
        "eventType": "deleted",
        "timestamp": "2024-01-19T15:30:00Z",
        "userId": "admin-user",
        "metadata": {
          "reason": "batch_operation",
          "operation": "delete"
        },
        "userAgent": "Mozilla/5.0...",
        "ipAddress": "192.168.1.100"
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2024-01-20T08:00:00Z"
}
```

## 📄 6. 单个会话操作

### 获取会话详情

```bash
curl -X GET "http://localhost:3001/api/sessions/{agentId}/{sessionId}"
```

### 删除单个会话

```bash
curl -X DELETE "http://localhost:3001/api/sessions/{agentId}/{sessionId}" \
  -H "Authorization: Bearer {admin-token}"
```

### JavaScript示例

```javascript
// 获取会话详情
async function getSessionDetail(agentId, sessionId) {
  const response = await fetch(`/api/sessions/${agentId}/${sessionId}`);
  const result = await response.json();
  return result.data;
}

// 删除会话
async function deleteSession(agentId, sessionId) {
  const response = await fetch(`/api/sessions/${agentId}/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  if (response.ok) {
    console.log('会话删除成功');
  } else {
    console.error('删除失败:', await response.text());
  }
}
```

## 🔧 错误处理

### 常见错误响应

```json
{
  "code": "VALIDATION_ERROR",
  "message": "page must be greater than or equal to 1",
  "timestamp": "2024-01-20T08:00:00Z"
}
```

```json
{
  "code": "UNAUTHORIZED",
  "message": "需要管理员权限",
  "timestamp": "2024-01-20T08:00:00Z"
}
```

```json
{
  "code": "AGENT_NOT_FOUND",
  "message": "智能体不存在: agent-123",
  "timestamp": "2024-01-20T08:00:00Z"
}
```

### JavaScript错误处理示例

```javascript
async function safeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        ...options.headers
      },
      ...options
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `HTTP ${response.status}`);
    }

    return result;
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
}

// 使用示例
try {
  const result = await safeApiCall('/api/sessions/agent-123/enhanced?page=1');
  console.log('成功:', result.data);
} catch (error) {
  console.error('失败:', error.message);
}
```

## 📋 完整使用示例

### 前端React组件示例

```jsx
import React, { useState, useEffect } from 'react';

function SessionManager({ agentId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });

  const loadSessions = async (page = 1, filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pagination.pageSize.toString(),
        ...filters
      });

      const response = await fetch(`/api/sessions/${agentId}/enhanced?${params}`);
      const result = await response.json();

      if (result.success) {
        setSessions(result.data.data);
        setPagination({
          page: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
          totalPages: result.data.totalPages
        });
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchOperation = async (sessionIds, operation, tags = []) => {
    try {
      const response = await fetch(`/api/sessions/${agentId}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sessionIds,
          operation,
          tags
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`成功操作 ${result.data.success} 个会话`);
        loadSessions(pagination.page); // 重新加载列表
      }
    } catch (error) {
      console.error('批量操作失败:', error);
    }
  };

  const handleExport = async (format, filters = {}) => {
    try {
      const response = await fetch(`/api/sessions/${agentId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          format,
          includeMessages: true,
          filters
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sessions-export.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [agentId]);

  return (
    <div>
      <div className="toolbar">
        <button onClick={() => handleExport('json')}>导出JSON</button>
        <button onClick={() => handleExport('csv')}>导出CSV</button>
        <button onClick={() => handleBatchOperation(
          sessions.filter(s => s.selected).map(s => s.chatId),
          'addTags',
          ['processed']
        )}>
          批量标记为已处理
        </button>
      </div>

      {loading ? (
        <div>加载中...</div>
      ) : (
        <div>
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>标题</th>
                <th>消息数量</th>
                <th>更新时间</th>
                <th>标签</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.chatId}>
                  <td><input type="checkbox" /></td>
                  <td>{session.title}</td>
                  <td>{session.messageCount}</td>
                  <td>{new Date(session.updatedAt).toLocaleString()}</td>
                  <td>{session.tags?.join(', ')}</td>
                  <td>
                    <button onClick={() => {/* 查看详情 */}}>查看</button>
                    <button onClick={() => handleBatchOperation([session.chatId], 'delete')}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              disabled={pagination.page <= 1}
              onClick={() => loadSessions(pagination.page - 1)}
            >
              上一页
            </button>
            <span>
              第 {pagination.page} 页，共 {pagination.totalPages} 页
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadSessions(pagination.page + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionManager;
```

这个完整的示例展示了如何在实际应用中使用FastGPT会话治理扩展的所有功能。包括会话列表查询、批量操作、导出功能和错误处理。