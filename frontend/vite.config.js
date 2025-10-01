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
        chunkSizeWarningLimit: 2048,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('echarts')) {
                            return 'echarts';
                        }
                        if (id.includes('react') || id.includes('scheduler')) {
                            return 'vendor';
                        }
                        if (id.includes('highlight.js') || id.includes('remark') || id.includes('rehype')) {
                            return 'markdown';
                        }
                        if (id.includes('zustand') || id.includes('axios')) {
                            return 'state-utils';
                        }
                    }
                    return undefined;
                },
            },
        },
    },
});
