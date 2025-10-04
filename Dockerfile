# ========================================
# LLMChat 后端多阶段 Docker 构建
# 优化镜像大小，提高构建速度
# ========================================

# ========================================
# 阶段 1: 依赖安装（共享层）
# ========================================
FROM node:18-alpine AS dependencies

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@8

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY shared-types/package.json ./shared-types/

# 安装生产依赖（缓存优化）
RUN pnpm install --frozen-lockfile --prod

# ========================================
# 阶段 2: 后端构建
# ========================================
FROM node:18-alpine AS backend-builder

WORKDIR /app

# 复制依赖
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules

# 复制后端源码
COPY backend ./backend
COPY shared-types ./shared-types
COPY tsconfig.json ./

# 构建后端
WORKDIR /app/backend
RUN npm run build

# ========================================
# 阶段 3: 前端构建
# ========================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# 复制依赖
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/frontend/node_modules ./frontend/node_modules

# 复制前端源码
COPY frontend ./frontend
COPY shared-types ./shared-types

# 构建前端
WORKDIR /app/frontend
RUN npm run build

# ========================================
# 阶段 4: 生产镜像（最小化）
# ========================================
FROM node:18-alpine AS production

# 安全：创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S llmchat -u 1001

WORKDIR /app

# 安装生产运行时依赖
RUN apk add --no-cache \
    tini \
    curl \
    && rm -rf /var/cache/apk/*

# 复制后端构建产物
COPY --from=backend-builder --chown=llmchat:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=llmchat:nodejs /app/backend/package.json ./backend/
COPY --from=dependencies --chown=llmchat:nodejs /app/backend/node_modules ./backend/node_modules

# 复制前端构建产物
COPY --from=frontend-builder --chown=llmchat:nodejs /app/frontend/dist ./frontend/dist

# 复制配置文件
COPY --chown=llmchat:nodejs config ./config

# 环境变量
ENV NODE_ENV=production \
    PORT=3001

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# 切换到非 root 用户
USER llmchat

# 使用 tini 作为初始化进程（处理僵尸进程）
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "backend/dist/index.js"]
