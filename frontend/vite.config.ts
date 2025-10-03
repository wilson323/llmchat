import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  
  build: {
    // 性能优化配置
    rollupOptions: {
      output: {
        // 手动代码分割
        manualChunks: {
          // React 核心库单独分割
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // 状态管理库
          'state-vendor': ['zustand'],
          
          // HTTP 和工具库
          'utils-vendor': ['axios'],
          
          // UI 组件库（如果有大型UI库，可以单独分割）
          // 'ui-vendor': ['@radix-ui/react-*'],
          
          // ECharts（按需加载，单独分割）
          'echarts': ['echarts'],
        },
        
        // 资源文件命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // 分块大小警告阈值（500kb）
    chunkSizeWarningLimit: 500,
    
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // 移除 console
        drop_debugger: true,     // 移除 debugger
        pure_funcs: ['console.log'], // 移除特定函数调用
      },
    },
    
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    
    // Source map（生产环境可关闭以减小体积）
    sourcemap: false,
  },
  
  // 优化依赖预构建
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
