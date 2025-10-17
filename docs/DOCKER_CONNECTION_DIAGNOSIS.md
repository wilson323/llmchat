# Docker容器连接问题分析

## 问题现象
- PostgreSQL容器已启动: postgres-zkteco (端口5443:5432)
- Redis容器已启动: redis-server (端口7788:6379)
- 连接测试: ECONNRESET (连接被重置)

## 可能原因

### 1. PostgreSQL容器未完全初始化 (60%)
- 首次启动需要30-60秒初始化数据库
- 建议: 在服务器上运行 docker logs postgres-zkteco 查看初始化状态

### 2. 网络配置问题 (30%)
- Docker容器可能只监听localhost
- 建议检查: docker inspect postgres-zkteco | grep IPAddress

### 3. PostgreSQL配置问题 (10%)
- listen_addresses 可能未设置为 '*'
- pg_hba.conf 可能未配置允许远程连接

## 推荐检查步骤

### 在服务器上执行:

`ash
# 1. 检查容器状态
docker ps | grep -E ''postgres-zkteco|redis-server''

# 2. 查看PostgreSQL日志（查找 ''database system is ready to accept connections''）
docker logs postgres-zkteco | tail -20

# 3. 查看Redis日志
docker logs redis-server | tail -10

# 4. 测试容器内部连接
docker exec -it postgres-zkteco psql -U username -d zkteco -c ''SELECT version();''

# 5. 测试Redis
docker exec -it redis-server redis-cli PING

# 6. 检查端口监听
netstat -tlnp | grep -E ''5443|7788''
`

### 如果PostgreSQL未完全初始化:
`ash
# 等待初始化完成（查找 ready to accept connections）
docker logs -f postgres-zkteco
`

### 如果需要修改PostgreSQL配置:
`ash
# 进入容器
docker exec -it postgres-zkteco bash

# 编辑配置
echo " listen_addresses = * \ >> /var/lib/postgresql/data/postgresql.conf
echo \host all all 0.0.0.0/0 md5\ >> /var/lib/postgresql/data/pg_hba.conf

# 重启容器
docker restart postgres-zkteco
`

## 临时解决方案

如果远程连接持续失败，可以在服务器上:
1. 安装psql客户端: apt-get install postgresql-client
2. 创建SSH隧道转发端口到本地
3. 或使用ngrok等工具暴露端口

