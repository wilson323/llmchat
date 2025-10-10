import fs from 'fs';
import path from 'path';
import { stripJsonComments } from './config';
import logger from '@/utils/logger';
import { resolveEnvInJsonc, getEnvNumber, getEnvBoolean, getEnvString } from '@/utils/envResolver';

export interface LoggingExporterConfig {
  type: 'http' | 'elasticsearch' | 'clickhouse';
  enabled?: boolean;
  endpoint?: string;
  index?: string;
  table?: string;
  headers?: Record<string, string>;
  apiKey?: string;
  username?: string;
  password?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

export interface AppConfig {
  logging?: {
    enabled?: boolean;
    dir?: string;
    record?: { normal?: boolean; stream?: boolean };
    include?: { raw?: boolean; normalized?: boolean };
    exporters?: LoggingExporterConfig[];
  };
  database?: {
    postgres?: {
      host: string;
      port?: number;
      user: string;
      password: string;
      database: string;
      ssl?: boolean;
    };
  };
  auth?: {
    tokenTTLSeconds?: number;
  };
}

const projectRoot = path.resolve(__dirname, '../../..');

const CONFIG_CANDIDATES = [
  path.join(projectRoot, 'config', 'config.jsonc'),
  path.join(projectRoot, 'config', 'config.json'),
];

export function loadAppConfig(): AppConfig {
  for (const file of CONFIG_CANDIDATES) {
    try {
      if (!fs.existsSync(file)) {
        continue;
      }
      const raw = fs.readFileSync(file, 'utf-8');
      const stripped = stripJsonComments(raw);

      // 解析环境变量占位符
      const resolved = resolveEnvInJsonc(stripped);

      const config = JSON.parse(resolved) as AppConfig;

      // 应用环境变量覆盖（环境变量优先级更高）
      if (config.database?.postgres) {
        config.database.postgres.host = getEnvString('DB_HOST', config.database.postgres.host);
        config.database.postgres.port = getEnvNumber('DB_PORT', config.database.postgres.port || 5432);
        config.database.postgres.user = getEnvString('DB_USER', config.database.postgres.user);
        config.database.postgres.password = getEnvString('DB_PASSWORD', config.database.postgres.password);
        config.database.postgres.database = getEnvString('DB_NAME', config.database.postgres.database);
        config.database.postgres.ssl = getEnvBoolean('DB_SSL', config.database.postgres.ssl || false);
      }

      if (config.auth) {
        config.auth.tokenTTLSeconds = getEnvNumber('TOKEN_TTL', config.auth.tokenTTLSeconds || 86400);
      }

      return config;
    } catch (error) {
      logger.warn('[AppConfig] Failed to parse configuration', { file, error });
    }
  }
  return {};
}

export function resolveLoggingExportersFromEnv(): LoggingExporterConfig[] {
  const exporters: LoggingExporterConfig[] = [];
  const httpEndpoint = process.env.LOG_EXPORT_HTTP_ENDPOINT;
  if (httpEndpoint) {
    const exporter: LoggingExporterConfig = {
      type: 'http',
      endpoint: httpEndpoint,
      batchSize: parseNumberEnv(process.env.LOG_EXPORT_HTTP_BATCH, 25),
      flushIntervalMs: parseNumberEnv(process.env.LOG_EXPORT_HTTP_INTERVAL, 2000),
    };
    const headers = parseHeadersEnv(process.env.LOG_EXPORT_HTTP_HEADERS);
    if (headers) {
      exporter.headers = headers;
    }
    exporters.push(exporter);
  }
  return exporters;
}

function parseHeadersEnv(headers?: string | null): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(headers);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {});
    }
  } catch (error) {
    logger.warn('[AppConfig] Failed to parse LOG_EXPORT_HTTP_HEADERS env', { error });
  }
  return undefined;
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
