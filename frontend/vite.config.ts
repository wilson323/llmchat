import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// WSL2环境专用最小化配置 - 解决rollup依赖问题
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // 极简rollup配置 - 避免平台特定依赖问题
    rollupOptions: {
      // 禁用所有可能导致依赖问题的功能
      treeshake: false,
      onwarn: (warning, warn) => {
        // 忽略所有警告，避免依赖解析问题
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      output: {
        // 最简单的输出配置
        manualChunks: undefined,
        chunkFileNames: '[name].js',
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        // 简化文件名避免特殊字符
        sanitizeFileName: (name) => name.replace(/[^a-zA-Z0-9.-]/g, '_')
      },
    },

    // 禁用所有可能触发复杂依赖的功能
    minify: false,
    sourcemap: false,
    target: 'es2015',

    // 构建性能优化
    chunkSizeWarningLimit: 5000,
    assetsInlineLimit: 0,

    // 强制使用内存文件系统，避免WSL2文件系统问题
    emptyOutDir: true,

    // 依赖优化 - 正确处理CommonJS模块
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
  },

  // 简化开发服务器配置 - 使用动态检测的后端端口
  server: {
    port: 3004,
    host: true,
    // 移除全局headers设置，让Vite根据文件类型自动设置正确的Content-Type
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // 只为API请求设置content-type
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
              if (req.headers['content-type']) {
                proxyReq.setHeader('Content-Type', req.headers['content-type']);
              }
            }
          });
        }
      }
    }
  },

  // 依赖优化配置 - 避免平台特定问题
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'lucide-react',
      'date-fns',
      'framer-motion'  // 添加 framer-motion 到预优化
    ],
    exclude: [
      // 排除可能导致问题的依赖
      'three',
      '@react-three/fiber',
      '@react-three/drei'
    ],
    force: true,
    esbuildOptions: {
      // 针对 framer-motion 的特殊处理
      target: 'es2020'
    }
  },

  // 环境变量配置
  define: {
    __WSL_BUILD__: 'true',
    __BACKEND_PORT__: '3005'
  },

  // 实验性功能 - 提高WSL2兼容性
  experimental: {
    renderBuiltUrl: (filename) => {
      return filename;
    }
  }
})
