/**
 * 测试服务器工具
 * 提供动态端口启动和清理功能
 */

import { app } from '../../index';
import logger from '../../utils/logger';

export interface TestServer {
  port: number;
  close: () => Promise<void>;
}

/**
 * 启动测试服务器
 * @returns 测试服务器实例，包含端口和关闭函数
 */
export async function startTestServer(): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any)?.port;
      if (!port) {
        reject(new Error('Unable to determine server port'));
        return;
      }

      logger.info(`🧪 测试服务器启动成功 - 端口: ${port}`);
      resolve({
        port,
        close: () => {
          return new Promise((resolveClose) => {
            server.close(() => {
              logger.info(`🧪 测试服务器关闭 - 端口: ${port}`);
              resolveClose();
            });
          });
        }
      });
    });

    // 错误处理
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port already in use: ${(server.address() as any)?.port || 'unknown'}`));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * 等待端口可用
 * @param port 要检查的端口
 * @param timeout 超时时间（毫秒）
 */
export async function waitForPortAvailable(port: number, timeout = 5000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const net = require('net');
      const server = net.createServer();

      await new Promise<void>((resolve, reject) => {
        server.listen(port, () => {
          server.close(() => resolve());
        });
        server.on('error', reject);
      });

      return; // 端口可用
    } catch (error: any) {
      if ((error as any).code !== 'EADDRINUSE') {
        throw error;
      }
      // 端口被占用，继续等待
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Port ${port} not available after ${timeout}ms`);
}
