/**
 * Vite配置 - Bundle分析版本
 * 
 * 用法：
 * pnpm run build:analyze
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    
    // Bundle分析插件
    visualizer({
      filename: './dist/stats.html',
      open: true, // 构建后自动打开分析报告
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // 'sunburst' | 'treemap' | 'network'
    }),
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  build: {
    // 生成sourcemap以便分析
    sourcemap: true,
    
    // 显示详细的构建信息
    reportCompressedSize: true,
    
    // 代码分割策略
    rollupOptions: {
      output: {
        // 手动分割chunks
        manualChunks: {
          // React相关
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // UI组件库
          'vendor-ui': ['@radix-ui/react-slot', 'lucide-react', 'framer-motion'],
          
          // 状态管理
          'vendor-state': ['zustand'],
          
          // 工具库
          'vendor-utils': ['axios', 'clsx', 'class-variance-authority', 'tailwind-merge'],
          
          // Markdown相关
          'vendor-markdown': [
            'react-markdown',
            'rehype-highlight',
            'rehype-raw',
            'remark-breaks',
            'remark-gfm',
          ],
          
          // ECharts（大型库）
          'vendor-echarts': ['echarts', 'echarts-for-react', 'echarts-countries-js'],
          
          // 高亮库
          'vendor-highlight': ['highlight.js'],
        },
        
        // 文件命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // 警告阈值（500KB）
    chunkSizeWarningLimit: 500,
  },
  
  // 优化配置
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'axios',
    ],
  },
});

