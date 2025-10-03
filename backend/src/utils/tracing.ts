/**
 * OpenTelemetry 分布式追踪配置
 * 支持 Jaeger/Zipkin/Tempo 等后端
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import logger from '@/utils/logger';

let sdk: NodeSDK | null = null;

/**
 * 初始化 OpenTelemetry
 */
export function initOpenTelemetry(): NodeSDK | null {
  // 仅在启用时初始化
  if (process.env.OTEL_ENABLED !== 'true') {
    logger.info('OpenTelemetry 追踪已禁用');
    return null;
  }

  try {
    // 配置追踪导出器
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

    // 配置资源（服务标识）
    const resource = defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'llmchat-backend',
        [ATTR_SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      })
    );

    // 初始化 SDK
    sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 1000,           // 最大队列大小
        maxExportBatchSize: 100,      // 批量导出大小
        scheduledDelayMillis: 5000,   // 导出延迟（5秒）
      }),
      instrumentations: [
        // 自动注入（HTTP/Express/数据库等）
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span: any, request: any) => {
              span.setAttribute('http.request_id', request.headers['x-request-id'] as string);
            },
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
            enhancedDatabaseReporting: true,
          },
        }),
      ],
    });

    // 启动 SDK
    sdk.start();

    logger.info('✓ OpenTelemetry 追踪已启用', {
      serviceName: process.env.OTEL_SERVICE_NAME || 'llmchat-backend',
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
      sdk?.shutdown()
        .then(() => logger.info('OpenTelemetry 已关闭'))
        .catch((error: any) => logger.error('OpenTelemetry 关闭失败', { error }));
    });

    return sdk;
  } catch (error) {
    logger.error('OpenTelemetry 初始化失败', { error });
    return null;
  }
}

/**
 * 获取 SDK 实例
 */
export function getSDK(): NodeSDK | null {
  return sdk;
}

/**
 * 手动关闭
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    logger.info('OpenTelemetry 已手动关闭');
  }
}
