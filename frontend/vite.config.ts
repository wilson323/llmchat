import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@services': resolve(__dirname, 'src/services'),
      '@store': resolve(__dirname, 'src/store'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@assets': resolve(__dirname, 'src/assets')
    },
  },

  build: {
    // 性能优化配置
    rollupOptions: {
      output: {
        // 增强版手动代码分割
        manualChunks: (id) => {
          // React 核心库
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor';
          }
          // 路由相关
          if (id.includes('react-router') || id.includes('@reach/router')) {
            return 'router-vendor';
          }
          // 状态管理
          if (id.includes('zustand') || id.includes('redux')) {
            return 'state-vendor';
          }
          // UI组件库
          if (id.includes('lucide-react') || id.includes('framer-motion')) {
            return 'ui-vendor';
          }
          // 工具库
          if (id.includes('lodash') || id.includes('date-fns') || id.includes('clsx')) {
            return 'utils-vendor';
          }
          // Chart相关
          if (id.includes('echarts') || id.includes('chart.js')) {
            return 'chart-vendor';
          }
          // 代码分割的组件
          if (id.includes('components/') && id.includes('.lazy')) {
            return 'lazy-components';
          }
          // 工作区组件
          if (id.includes('workspace/')) {
            return 'workspace-chunk';
          }
          // 管理后台组件
          if (id.includes('admin/')) {
            return 'admin-chunk';
          }
          // 聊天组件
          if (id.includes('chat/')) {
            return 'chat-chunk';
          }
          // 产品相关
          if (id.includes('product/')) {
            return 'product-chunk';
          }
          // 语音相关
          if (id.includes('voice/')) {
            return 'voice-chunk';
          }
          // CAD相关
          if (id.includes('cad/')) {
            return 'cad-chunk';
          }
          return null;
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'react-vendor') {
            return 'assets/react-[hash].js';
          }
          return `assets/[name]-[hash].js`;
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },

    // 启用 CSS 代码分割和压缩
    cssCodeSplit: true,
    cssMinify: true,

    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        safari10: true,
      },
    },

    // 分块大小警告限制
    chunkSizeWarningLimit: 1000,

    // 启用 source map 用于生产调试
    sourcemap: false,
  },

  // 开发服务器配置
  server: {
    port: 3000,
    host: true,
  },

  // 预览服务器配置
  preview: {
    port: 4173,
    host: true,
  },

  // 依赖优化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'framer-motion',
      'lucide-react',
      'date-fns',
      'clsx',
      'tailwind-merge',
    ],
  },

  // 环境变量
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})