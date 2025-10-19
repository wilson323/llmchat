/**
 * 简化的队列服务初始化
 */

import logger from '@/utils/logger';
import { createErrorFromUnknown } from '@/types/errors';

/**
 * 初始化队列服务
 */
export async function initQueueService(): Promise<void> {
  try {
    logger.info("🚀 初始化队列服务...");
    logger.info("⏭️ 简化模式：跳过复杂队列服务初始化");
    logger.info("✅ 队列服务初始化完成（简化模式）");
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'initQueueService',
      operation: 'initQueueService',
    });
    logger.error("❌ 队列服务初始化失败:", error.toLogObject());
    logger.info("📝 提示: 队列服务对核心功能不是必需的，应用可以正常运行");
  }
}

/**
 * 关闭队列服务
 */
export async function shutdownQueueService(): Promise<void> {
  try {
    logger.info("🔄 正在关闭队列服务...");
    logger.info("⏭️ 简化模式：跳过复杂队列服务关闭");
    logger.info("✅ 队列服务已关闭");
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'initQueueService',
      operation: 'shutdownQueueService',
    });
    logger.error("❌ 队列服务关闭失败:", error.toLogObject());
  }
}