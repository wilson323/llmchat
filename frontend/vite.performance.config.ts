import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * 性能优化版 Vite 配置
 * 专门用于TypeScript编译性能优化和内存管理
 */
export default defineConfig({
  plugins: [
    react({
      // 启用 React Fast Refresh
      fastRefresh: true,
      // 优化 JSX 运行时
      jsxRuntime: 'automatic',
      // 禁用类型检查以提升性能（使用外部TypeScript）
      babel: {
        plugins: []
      }
    })
  ],

  // TypeScript 配置优化
  esbuild: {
    // 禁用 esbuild 的类型检查，交给外部 TypeScript 处理
    target: 'es2020',
    // 保持更好的调试体验
    keepNames: false
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/store': resolve(__dirname, 'src/store'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/utils': resolve(__dirname, 'src/utils'),
    }
  },

  build: {
    // 启用源码映射（生产环境可选）
    sourcemap: false,
    
    // 构建目标
    target: 'es2020',
    
    // 输出目录
    outDir: 'dist',
    
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        // 移除 console.log
        drop_console: true,
        // 移除 debugger
        drop_debugger: true,
        // 移除未使用的代码
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: {
        // 保留类名用于调试
        keep_classnames: false,
        keep_fnames: false,
      },
    },

    // 代码分割策略
    rollupOptions: {
      output: {
        // 手动代码分割
        manualChunks: {
          // React 相关
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // 状态管理
          'state-vendor': ['zustand'],
          
          // UI 组件库
          'ui-vendor': [
            'lucide-react',
            'framer-motion',
            'react-hot-toast',
            'clsx',
            'class-variance-authority',
            'tailwind-merge'
          ],
          
          // 图表库
          'chart-vendor': [
            'echarts',
            'echarts-for-react',
            'echarts-countries-js'
          ],
          
          // 工具库
          'utils-vendor': [
            'axios',
            'date-fns',
            'highlight.js'
          ],
          
          // 3D 和 CAD 相关
          '3d-vendor': [
            'three',
            '@react-three/fiber',
            '@react-three/drei',
            'dxf-viewer'
          ]
        },
        
        // 文件命名策略
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? 
            chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `js/[name]-[hash].js`;
        },
        
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name)) {
            return `media/[name]-[hash][extname]`;
          }
          
          if (/\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i.test(assetInfo.name)) {
            return `images/[name]-[hash][extname]`;
          }
          
          if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name)) {
            return `fonts/[name]-[hash][extname]`;
          }
          
          return `assets/[name]-[hash][extname]`;
        }
      },
      
      // 外部依赖（如果需要 CDN 加载）
      external: [],
    },

    // 压缩配置
    cssCodeSplit: true,
    
    // chunk 大小警告限制
    chunkSizeWarningLimit: 1000,
    
    // 静态资源内联限制
    assetsInlineLimit: 4096, // 4kb 以下内联
    
    // 构建性能优化
    reportCompressedSize: true,
    
    // 预构建配置
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },

  // 开发服务器配置 - 内存优化
  server: {
    port: 3000,
    host: true,
    open: false,

    // 内存和性能优化
    watch: {
      // 减少文件监听数量，提升性能
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/.git/**',
        '**/.*',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stories.*'
      ],
      // 优化监听延迟
      usePolling: false,
      interval: 100
    },

    // 代理配置
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },

  // 依赖优化配置 - 内存优化
  optimizeDeps: {
    // 预构建包含的依赖 - 优化内存使用
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'lucide-react',
      'date-fns',
      'clsx',
      'framer-motion',
      'axios'
    ],

    // 排除预构建的依赖（大型的或有特殊需求的）
    exclude: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'echarts',
      'echarts-for-react',
      'dxf-viewer',
      '@tanstack/react-virtual'
    ],

    // 强制重新构建
    force: false,

    // 预构建选项 - 内存优化
    esbuildOptions: {
      target: 'es2020',
      // 减少内存占用
      minify: false,
      define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
        // 减少内存泄漏
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
      }
    }
  },

  // 环境变量配置
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },

  // CSS 配置
  css: {
    // CSS 模块化
    modules: {
      localsConvention: 'camelCase'
    },
    
    // PostCSS 配置
    postcss: {
      plugins: [
        // Tailwind CSS 会在 postcss.config.js 中配置
      ]
    },
    
    // 预处理器配置
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  },

  // 预览配置
  preview: {
    port: 4173,
    host: true
  },

  // 实验性功能
  experimental: {
    // 启用构建优化
    renderBuiltUrl: (filename, { hostType }) => {
      if (hostType === 'js') {
        return { js: `/${filename}` }
      } else {
        return { relative: true }
      }
    }
  },

  // 插件配置
  esbuild: {
    // 自定义 esbuild 配置
    target: 'es2020',
    // 保留类名用于调试
    keepNames: false
  }
})
