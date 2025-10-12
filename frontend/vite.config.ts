import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Performance optimization plugin
const performanceOptimization = () => ({
  name: 'performance-optimization',
  generateBundle(options: any, bundle: any) {
    // Analyze bundle sizes and emit warnings
    const chunks = Object.values(bundle) as any[];
    chunks.forEach(chunk => {
      if (chunk.type === 'chunk' && chunk.code && chunk.code.length > 500000) {
        console.warn(`Large chunk detected: ${chunk.fileName} (${(chunk.code.length / 1024).toFixed(2)} KB)`);
      }
    });
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    performanceOptimization()
  ],
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
          if (id.includes('zustand') || id.includes('redux') || id.includes('jotai')) {
            return 'state-vendor';
          }
          // UI组件库
          if (id.includes('lucide-react') || id.includes('framer-motion') || id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          // 工具库
          if (id.includes('lodash') || id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'utils-vendor';
          }
          // Three.js 3D库
          if (id.includes('three') || id.includes('@react-three') || id.includes('three-stdlib')) {
            return 'three-vendor';
          }
          // Chart相关
          if (id.includes('echarts') || id.includes('chart.js') || id.includes('recharts')) {
            return 'chart-vendor';
          }
          // 代码分割的组件
          if (id.includes('components/') && (id.includes('.lazy') || id.includes('code-splitting'))) {
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
          // 性能优化组件
          if (id.includes('performance/') || id.includes('optimization/')) {
            return 'performance-chunk';
          }
          // 开发工具组件
          if (id.includes('dev-tools/') || id.includes('debug/')) {
            return 'dev-tools-chunk';
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
    chunkSizeWarningLimit: 800,

    // 启用实验性功能
    experimental: {
      renderBuiltUrl: (filename: string, { hostType }: { hostType: string }) => {
        if (hostType === 'js') {
          return { js: `/${filename}` };
        }
        return { relative: true };
      },
    },

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
      '@radix-ui/react-slot',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
    ],
    exclude: [
      'three', // Three.js is loaded on demand
      'echarts', // ECharts is loaded on demand
      'monaco-editor', // Monaco editor is loaded on demand
    ],
  },

  // 环境变量
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})