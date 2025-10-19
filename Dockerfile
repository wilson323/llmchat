# ==========================================
# LLMChat Advanced Multi-Stage Dockerfile
# 企业级容器化部署解决方案
# ==========================================

# ==========================================
# 阶段 1: 基础环境设置
# ==========================================
FROM node:20-alpine AS base

# 设置环境变量
ENV NODE_VERSION=20
ENV PNPM_VERSION=8.15.0
ENV NODE_ENV=production

# 安装系统依赖
RUN apk add --no-cache \
    git \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/* \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 安装 pnpm
RUN npm install -g pnpm@${PNPM_VERSION}

# ==========================================
# 阶段 2: 依赖安装（缓存优化）
# ==========================================
FROM base AS dependencies

# 设置 pnpm 存储目录
RUN pnpm config set store-dir /root/.pnpm-store

# 安装所有依赖
RUN pnpm install --frozen-lockfile

# ==========================================
# 阶段 3: 后端构建
# ==========================================
FROM base AS backend-builder

# 复制后端源代码
COPY backend/ ./backend/
COPY shared-types/ ./shared-types/
COPY tsconfig.json ./

# 复制依赖
COPY --from=dependencies /app/node_modules ./node_modules

# 构建后端
RUN pnpm run backend:build

# ==========================================
# 阶段 4: 前端构建
# ==========================================
FROM base AS frontend-builder

# 复制前端源代码
COPY frontend/ ./frontend/
COPY shared-types/ ./shared-types/

# 复制依赖
COPY --from=dependencies /app/node_modules ./node_modules

# 构建前端
RUN pnpm run frontend:build

# ==========================================
# 阶段 5: 后端生产镜像
# ==========================================
FROM node:20-alpine AS backend

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=Asia/Shanghai

# 安装生产运行时依赖
RUN apk add --no-cache \
    curl \
    ca-certificates \
    dumb-init \
    tzdata \
    && rm -rf /var/cache/apk/* \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S llmchat -u 1001 -G nodejs

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm@${PNPM_VERSION}

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 复制后端构建产物
COPY --from=backend-builder --chown=llmchat:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=llmchat:nodejs /app/shared-types/dist ./shared-types/dist

# 复制后端运行时配置
COPY --chown=llmchat:nodejs backend/src ./backend/src

# 创建必要的目录
RUN mkdir -p /app/logs /app/uploads /app/tmp && \
    chown -R llmchat:nodejs /app

# 复制健康检查脚本
COPY docker/backend-health-check.sh /app/health-check.sh
RUN chmod +x /app/health-check.sh && \
    chown llmchat:nodejs /app/health-check.sh

# 切换到非root用户
USER llmchat

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/health-check.sh || exit 1

# 暴露端口
EXPOSE 3001

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]

# ==========================================
# 阶段 6: 前端生产镜像
# ==========================================
FROM nginx:alpine AS frontend

# 设置环境变量
ENV TZ=Asia/Shanghai

# 安装必要的工具
RUN apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/* \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

# 复制自定义nginx配置
COPY docker/nginx-frontend.conf /etc/nginx/nginx.conf

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# 创建非root用户
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# 设置权限
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chown -R nginx:nginx /var/run

# 创建nginx运行时目录
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# 复制健康检查脚本
COPY docker/frontend-health-check.sh /app/health-check.sh
RUN chmod +x /app/health-check.sh

# 切换到非root用户
USER nginx

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/health-check.sh || exit 1

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]

# ==========================================
# 阶段 7: 完整应用镜像（前后端一体化）
# ==========================================
FROM node:20-alpine AS full-application

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=Asia/Shanghai

# 安装系统依赖
RUN apk add --no-cache \
    curl \
    ca-certificates \
    nginx \
    dumb-init \
    tzdata \
    && rm -rf /var/cache/apk/* \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

# 创建非root用户
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm@${PNPM_VERSION}

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 复制构建产物
COPY --from=backend-builder --chown=appuser:appuser /app/backend/dist ./backend/dist
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder --chown=appuser:appuser /app/shared-types/dist ./shared-types/dist

# 复制后端源代码
COPY --chown=appuser:appuser backend/src ./backend/src

# 复制nginx配置
COPY docker/nginx-full.conf /etc/nginx/nginx.conf

# 创建必要的目录
RUN mkdir -p /app/logs /app/uploads /app/tmp /app/frontend/static && \
    chown -R appuser:appuser /app

# 复制前端静态文件到nginx目录
RUN cp -r /app/frontend/dist/* /app/frontend/static/ && \
    chown -R appuser:appuser /app/frontend/static

# 复制启动脚本
COPY docker/start-full-application.sh /app/start.sh
RUN chmod +x /app/start.sh && \
    chown appuser:appuser /app/start.sh

# 复制健康检查脚本
COPY docker/full-health-check.sh /app/health-check.sh
RUN chmod +x /app/health-check.sh && \
    chown appuser:appuser /app/health-check.sh

# 切换到非root用户
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/health-check.sh || exit 1

# 暴露端口
EXPOSE 3001 80

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]
