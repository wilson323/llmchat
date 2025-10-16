# LLMChat 技术规范详细说明 v1.0.0

本文档是技术实现细节的**单一真实来源**。

## 1. 认证安全
- JWT: HS256算法, 1小时过期
- 密码: bcrypt, salt=10
- 速率: 登录5次/分/IP, API 100次/分/用户

## 2. 性能指标
- API: P95<200ms, P99<500ms
- 首屏: P95<3s
- 并发: 100用户@100QPS, CPU<50%, 内存<500MB

## 3. 测试标准
- 核心模块: 90%覆盖率
- 业务逻辑: 80%覆盖率
- 整体: 80%覆盖率

## 4. 数据库
- PostgreSQL池: 5-20连接, 30s超时
- Redis池: 5-20连接, 5s超时

## 5. 日志监控
- Winston: JSON格式, 每日轮转, 10文件, 20MB/文件
- Prometheus: duration, requests, connections, errors

详见各章节。
