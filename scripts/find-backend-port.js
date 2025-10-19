#!/usr/bin/env node

/**
 * 动态检测后端端口的脚本
 * 扫描3000-3010端口范围，找到运行LLMChat后端的端口
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 要检测的端口范围
const PORT_RANGE = {
  start: 3005,
  end: 3010
};

// 检测指定端口是否运行着LLMChat后端
async function checkBackendPort(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          // 检查是否是LLMChat后端的健康检查响应
          if (response.message && response.message.includes('LLMChat Backend')) {
            resolve({ port, valid: true, response });
          } else {
            resolve({ port, valid: false });
          }
        } catch (error) {
          resolve({ port, valid: false });
        }
      });
    });

    req.on('error', () => {
      resolve({ port, valid: false });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ port, valid: false });
    });

    req.end();
  });
}

// 检测所有可能的端口
async function findBackendPort() {
  const results = [];

  for (let port = PORT_RANGE.start; port <= PORT_RANGE.end; port++) {
    const result = await checkBackendPort(port);
    if (result.valid) {
      results.push(result);
    }
  }

  return results;
}

// 生成Vite配置文件
function generateViteConfig(backendPort) {
  const configTemplate = `import { defineConfig } from 'vite'
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
    proxy: {
      '/api': {
        target: 'http://localhost:${backendPort}',
        changeOrigin: true,
        secure: false,
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
      'date-fns'
    ],
    exclude: [
      // 排除可能导致问题的依赖
      'three',
      '@react-three/fiber',
      '@react-three/drei'
    ],
    force: true,
  },

  // 环境变量配置
  define: {
    __WSL_BUILD__: 'true',
    __BACKEND_PORT__: '${backendPort}'
  },

  // 实验性功能 - 提高WSL2兼容性
  experimental: {
    renderBuiltUrl: (filename) => {
      return filename;
    }
  }
})
`;

  const configPath = path.join(__dirname, '../frontend/vite.config.ts');

  try {
    fs.writeFileSync(configPath, configTemplate);
    console.log(`✅ 已更新Vite配置，后端端口: ${backendPort}`);
    return true;
  } catch (error) {
    console.error(`❌ 更新Vite配置失败:`, error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🔍 正在检测LLMChat后端端口...');

  const backendPorts = await findBackendPort();

  if (backendPorts.length === 0) {
    console.log('❌ 未找到运行中的LLMChat后端服务');
    console.log('请确保后端服务已启动');
    process.exit(1);
  }

  if (backendPorts.length > 1) {
    console.log('⚠️  发现多个LLMChat后端实例:');
    backendPorts.forEach(result => {
      console.log(`   - 端口 ${result.port}: ${result.response.message}`);
    });
    console.log('将使用第一个发现的端口');
  }

  const selectedPort = backendPorts[0].port;
  console.log(`✅ 发现LLMChat后端运行在端口: ${selectedPort}`);

  const success = generateViteConfig(selectedPort);

  if (success) {
    console.log('🎉 动态端口配置完成！');
  } else {
    console.log('❌ 配置更新失败');
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { findBackendPort, generateViteConfig };