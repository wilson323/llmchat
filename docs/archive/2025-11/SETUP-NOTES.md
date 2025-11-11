# 项目配置笔记

## ✅ 已完成的配置

### 1. 包管理器配置
- **包管理器**: pnpm (而非 npm)
- **原因**: 前端项目使用 pnpm-lock.yaml
- **注意**: 使用 `pnpm install` 而非 `npm install`

### 2. Rollup 原生模块修复
- **问题**: `@rollup/rollup-win32-x64-msvc` 模块缺失
- **原因**: npm 与 pnpm 依赖安装不一致
- **解决**:
  ```bash
  # 删除所有 node_modules 和 lock 文件
  rm -rf node_modules frontend/node_modules backend/node_modules
  rm -rf package-lock.json frontend/package-lock.json backend/package-lock.json

  # 使用 pnpm 重新安装
  pnpm install
  ```

### 3. ECharts 中国地图配置
- **问题**: 新版 echarts (5.6.0) 不再内置地图 JSON 数据
- **解决方案**: 动态加载 GeoJSON 数据
- **文件位置**: `frontend/public/maps/china.json`
- **数据来源**: 阿里云 DataV (569KB)

**修改的文件**:
- `frontend/src/components/admin/AdminHome.tsx`
  - 移除静态导入: `import chinaMap from 'echarts/map/json/china.json?json';`
  - 添加动态加载:
    ```typescript
    fetch('/maps/china.json')
      .then(res => res.json())
      .then(chinaMap => {
        echarts.registerMap('china', chinaMap);
      });
    ```

### 4. 服务端口配置
- **后端**: http://localhost:3001
- **前端**: http://localhost:3003 (3000-3002 已被占用)

## 🚀 启动项目

### 推荐方式 (使用 pnpm)
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### Windows 脚本
```bash
# 快速启动
quick-start.bat

# 完整启动(带检查)
start-dev.bat

# 调试启动(详细诊断)
start-dev-debug.bat

# 环境测试
test-env.bat
```

### Unix/Linux 脚本
```bash
# 快速启动
./quick-start.sh

# 完整启动
./start-dev.sh
```

## 📋 依赖版本

### 核心依赖
- Node.js: v24.0.2
- pnpm: v10.15.1
- npm: 11.3.0

### 前端
- React: 18.x
- Vite: 5.4.20
- echarts: 5.6.0
- TypeScript: 5.9.2

### 后端
- Express: 4.21.2
- TypeScript: 5.9.2
- ts-node-dev: 2.0.0

## ⚠️ 常见问题

### 1. 端口被占用
**现象**: `Port 3000 is in use, trying another one...`

**解决**: Vite 会自动尝试其他端口 (3001, 3002, 3003...)

### 2. 地图不显示
**原因**:
- `public/maps/china.json` 文件缺失
- Vite 服务器未重启

**解决**:
```bash
# 下载地图数据
curl -L "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json" -o frontend/public/maps/china.json

# 重启 Vite
pnpm dev
```

### 3. 依赖安装失败
**解决**:
```bash
# 清理缓存
pnpm store prune

# 重新安装
rm -rf node_modules frontend/node_modules backend/node_modules
pnpm install
```

## 📚 文档

- [CLAUDE.md](./CLAUDE.md) - 完整开发文档
- [START.md](./START.md) - 跨平台启动指南
- [WINDOWS-SCRIPTS.md](./WINDOWS-SCRIPTS.md) - Windows 脚本详解
- [TROUBLESHOOTING-WINDOWS.md](./TROUBLESHOOTING-WINDOWS.md) - Windows 问题排查

## 🔄 更新日志

### 2025-09-30
- ✅ 修复 Rollup 原生模块缺失问题
- ✅ 配置 ECharts 中国地图动态加载
- ✅ 更新项目文档
- ✅ 验证前后端服务正常启动