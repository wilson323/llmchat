# 依赖分析报告

## 概述

本报告分析了 LLMChat 项目的依赖情况，包括前端、后端和共享类型的依赖。我们将依赖分为直接依赖和间接依赖，并根据更新风险分为破坏性更新和非破坏性更新。

## 前端依赖分析

### 直接依赖 (Direct Dependencies)

| 依赖包                   | 版本         | 类型          | 更新风险 | 说明                     |
| ------------------------ | ------------ | ------------- | -------- | ------------------------ |
| @llmchat/shared-types    | workspace:\* | 工作区依赖    | 低       | 项目内部共享类型         |
| @radix-ui/react-slot     | ^1.2.3       | UI 组件       | 低       | Radix UI Slot 组件       |
| @react-three/drei        | ^9.92.0      | 3D 库         | 中       | Three.js 扩展库          |
| @react-three/fiber       | ^8.15.0      | 3D 库         | 中       | React Three Fiber        |
| @sentry/react            | ^10.17.0     | 监控          | 低       | Sentry 错误追踪          |
| @sentry/tracing          | ^7.120.4     | 监控          | 低       | Sentry 性能追踪          |
| axios                    | ^1.6.2       | HTTP 客户端   | 低       | HTTP 请求库              |
| class-variance-authority | ^0.7.1       | 工具库        | 低       | CSS 类名管理             |
| clsx                     | ^2.0.0       | 工具库        | 低       | CSS 类名工具             |
| date-fns                 | ^4.1.0       | 工具库        | 中       | 日期处理库               |
| dxf-viewer               | ^1.0.43      | 文件处理      | 中       | DXF 文件查看器           |
| echarts                  | ^5.6.0       | 图表库        | 中       | 数据可视化图表           |
| echarts-countries-js     | ^1.0.5       | 图表库        | 中       | ECharts 国家数据         |
| echarts-for-react        | ^3.0.2       | 图表库        | 中       | React ECharts 封装       |
| framer-motion            | ^12.23.21    | 动画库        | 中       | React 动画库             |
| highlight.js             | ^11.11.1     | 代码高亮      | 低       | 代码语法高亮             |
| lucide-react             | ^0.295.0     | UI 图标       | 低       | Lucide 图标库            |
| react                    | ^18.2.0      | 核心框架      | 高       | React 核心库             |
| react-dom                | ^18.2.0      | 核心框架      | 高       | React DOM 渲染           |
| react-dropzone           | ^14.2.3      | 文件上传      | 低       | 文件拖拽上传             |
| react-markdown           | ^10.1.0      | Markdown 渲染 | 中       | Markdown 渲染组件        |
| react-router-dom         | ^7.9.2       | 路由          | 高       | React 路由管理           |
| rehype-highlight         | ^7.0.2       | Markdown 处理 | 低       | 代码高亮处理器           |
| rehype-raw               | ^7.0.0       | Markdown 处理 | 低       | 原始 HTML 处理器         |
| remark-breaks            | ^4.0.0       | Markdown 处理 | 低       | 换行处理器               |
| remark-gfm               | ^4.0.1       | Markdown 处理 | 低       | GitHub Flavored Markdown |
| tailwind-merge           | ^2.2.0       | CSS 工具      | 低       | Tailwind CSS 类名合并    |
| three                    | ^0.160.0     | 3D 库         | 中       | Three.js 核心库          |
| zustand                  | ^4.4.7       | 状态管理      | 中       | React 状态管理库         |

### 开发依赖 (Dev Dependencies)

| 依赖包                           | 版本     | 类型     | 更新风险 | 说明                      |
| -------------------------------- | -------- | -------- | -------- | ------------------------- |
| @tailwindcss/postcss             | ^4.1.13  | CSS 框架 | 中       | Tailwind CSS PostCSS 插件 |
| @testing-library/jest-dom        | ^6.9.1   | 测试工具 | 低       | Jest DOM 断言库           |
| @testing-library/react           | ^14.1.2  | 测试工具 | 低       | React 测试工具            |
| @testing-library/user-event      | ^14.5.1  | 测试工具 | 低       | 用户事件模拟              |
| @types/react                     | ^18.2.45 | 类型定义 | 低       | React 类型定义            |
| @types/react-dom                 | ^18.2.18 | 类型定义 | 低       | React DOM 类型定义        |
| @types/three                     | ^0.160.0 | 类型定义 | 低       | Three.js 类型定义         |
| @typescript-eslint/eslint-plugin | ^6.15.0  | 代码质量 | 低       | TypeScript ESLint 插件    |
| @typescript-eslint/parser        | ^6.15.0  | 代码质量 | 低       | TypeScript ESLint 解析器  |
| @vitejs/plugin-react             | ^4.2.1   | 构建工具 | 低       | Vite React 插件           |
| @vitest/ui                       | ^1.1.0   | 测试工具 | 低       | Vitest UI 界面            |
| autoprefixer                     | ^10.4.16 | CSS 工具 | 低       | CSS 前缀自动添加          |
| eslint                           | ^8.56.0  | 代码质量 | 中       | JavaScript 代码检查工具   |
| eslint-plugin-react              | ^7.33.2  | 代码质量 | 低       | React ESLint 插件         |
| eslint-plugin-react-hooks        | ^4.6.0   | 代码质量 | 低       | React Hooks ESLint 插件   |
| eslint-plugin-react-refresh      | ^0.4.5   | 开发工具 | 低       | React Refresh ESLint 插件 |
| i18next                          | ^25.5.3  | 国际化   | 中       | 国际化库                  |
| i18next-browser-languagedetector | ^8.2.0   | 国际化   | 中       | 浏览器语言检测            |
| jsdom                            | ^23.0.1  | 测试工具 | 中       | JavaScript DOM 实现       |
| postcss                          | ^8.4.32  | CSS 工具 | 中       | CSS 处理工具              |
| react-i18next                    | ^16.0.0  | 国际化   | 中       | React 国际化库            |
| tailwindcss                      | ^4.1.13  | CSS 框架 | 中       | Tailwind CSS 框架         |
| terser                           | ^5.44.0  | 构建工具 | 低       | JavaScript 压缩工具       |
| typescript                       | ^5.3.3   | 编程语言 | 高       | TypeScript 编译器         |
| vite                             | ^5.0.10  | 构建工具 | 中       | 前端构建工具              |
| vitest                           | ^1.1.0   | 测试工具 | 中       | Vite 测试框架             |
| web-vitals                       | ^5.1.0   | 性能监控 | 低       | Web 性能指标              |

## 后端依赖分析

### 直接依赖 (Direct Dependencies)

| 依赖包                    | 版本         | 类型        | 更新风险 | 说明                |
| ------------------------- | ------------ | ----------- | -------- | ------------------- |
| @llmchat/shared-types     | workspace:\* | 工作区依赖  | 低       | 项目内部共享类型    |
| @sentry/node              | ^10.17.0     | 监控        | 低       | Sentry Node.js SDK  |
| @sentry/profiling-node    | ^10.17.0     | 监控        | 低       | Sentry 性能分析     |
| axios                     | ^1.6.2       | HTTP 客户端 | 低       | HTTP 请求库         |
| bcrypt                    | ^6.0.0       | 安全        | 中       | 密码加密库          |
| bcryptjs                  | ^3.0.2       | 安全        | 中       | JavaScript 密码加密 |
| compression               | ^1.7.4       | 中间件      | 低       | HTTP 压缩中间件     |
| cookie-parser             | ^1.4.6       | 中间件      | 低       | Cookie 解析中间件   |
| cors                      | ^2.8.5       | 中间件      | 低       | CORS 中间件         |
| dotenv                    | ^16.3.1      | 配置        | 低       | 环境变量加载        |
| dxf-parser                | ^1.1.2       | 文件处理    | 中       | DXF 文件解析器      |
| dxf-writer                | ^1.18.4      | 文件处理    | 中       | DXF 文件写入器      |
| express                   | ^4.18.2      | 核心框架    | 高       | Express.js 框架     |
| express-rate-limit        | ^8.1.0       | 安全        | 中       | 请求频率限制        |
| geoip-lite                | ^1.4.6       | 工具库      | 中       | IP 地理位置查询     |
| helmet                    | ^7.1.0       | 安全        | 中       | 安全 HTTP 头设置    |
| ioredis                   | ^5.8.0       | 数据库      | 中       | Redis 客户端        |
| joi                       | ^17.11.0     | 验证        | 中       | 数据验证库          |
| jsonwebtoken              | ^9.0.2       | 安全        | 中       | JWT 令牌处理        |
| mongodb                   | ^6.20.0      | 数据库      | 高       | MongoDB 驱动        |
| multer                    | ^1.4.5-lts.1 | 文件上传    | 中       | 文件上传中间件      |
| pg                        | ^8.16.3      | 数据库      | 高       | PostgreSQL 客户端   |
| rate-limiter-flexible     | ^2.4.1       | 安全        | 中       | 灵活的频率限制      |
| uuid                      | ^9.0.1       | 工具库      | 低       | UUID 生成器         |
| winston                   | ^3.18.3      | 日志        | 低       | 日志记录库          |
| winston-daily-rotate-file | ^5.0.0       | 日志        | 低       | 日志文件轮转        |

### 开发依赖 (Dev Dependencies)

| 依赖包                | 版本     | 类型     | 更新风险 | 说明                    |
| --------------------- | -------- | -------- | -------- | ----------------------- |
| @opentelemetry/\*     | ^0.64.6+ | 监控     | 中       | OpenTelemetry 工具      |
| @types/\*             | 多个     | 类型定义 | 低       | TypeScript 类型定义     |
| @typescript-eslint/\* | ^6.15.0  | 代码质量 | 低       | TypeScript ESLint 工具  |
| eslint                | ^8.56.0  | 代码质量 | 中       | JavaScript 代码检查工具 |
| jest                  | ^29.7.0  | 测试工具 | 中       | JavaScript 测试框架     |
| ts-jest               | ^29.1.1  | 测试工具 | 低       | TypeScript Jest 支持    |
| ts-node-dev           | ^2.0.0   | 开发工具 | 低       | TypeScript 开发服务器   |
| tsconfig-paths        | ^4.2.0   | 开发工具 | 低       | TypeScript 路径映射     |
| typescript            | ^5.3.3   | 编程语言 | 高       | TypeScript 编译器       |

## 已废弃依赖清单

根据 pnpm-lock.yaml 中的废弃标记，以下依赖需要更新：

### 高优先级更新（安全相关）

| 依赖包           | 当前版本 | 问题     | 建议版本                  |
| ---------------- | -------- | -------- | ------------------------- |
| @eslint/eslintrc | < latest | 已废弃   | 使用@eslint/config-array  |
| @eslint/js       | < latest | 已废弃   | 使用@eslint/object-schema |
| glob             | < v9     | 已废弃   | 升级到 v9+                |
| inflight         | < latest | 已废弃   | 使用 lru-cache            |
| rimraf           | < v4     | 已废弃   | 升级到 v4+                |
| multer           | 1.x      | 安全漏洞 | 升级到 2.x                |

### 中优先级更新

| 依赖包   | 当前版本 | 问题         | 建议版本            |
| -------- | -------- | ------------ | ------------------- |
| bcryptjs | 3.0.2    | 类型定义重复 | 移除@types/bcryptjs |
| mongodb  | 6.20.0   | 类型定义重复 | 移除@types/mongodb  |

## 更新建议

### 立即更新（安全相关）

1. 更新`multer`到 2.x 版本
2. 更新`rimraf`到 v4+版本
3. 更新`glob`到 v9+版本

### 近期更新（功能改进）

1. 更新`@eslint/eslintrc`和相关包
2. 移除重复的类型定义包
3. 更新`ioredis`到最新稳定版本

### 长期规划

1. 监控`react-router-dom` v7 的稳定性
2. 考虑`three.js`和`@react-three/*`的版本兼容性
3. 跟踪`framer-motion`的 API 变化
