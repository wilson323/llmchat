import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/styles': path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心库（必须首先加载）
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 图表库（AdminHome 专用，按需加载）
          'chart-vendor': ['echarts', 'echarts-for-react'],
          // UI 动画与组件库
          'ui-vendor': ['framer-motion', 'lucide-react'],
          // Markdown 渲染（聊天消息专用）
          'markdown-vendor': [
            'react-markdown',
            'rehype-highlight',
            'rehype-raw',
            'remark-breaks',
            'remark-gfm',
          ],
          // 状态管理与HTTP客户端
          'state-utils': ['zustand', 'axios'],
        },
      },
    },
    // 提高 chunk 大小警告阈值（优化后可适当放宽）
    chunkSizeWarningLimit: 600,
  },
});