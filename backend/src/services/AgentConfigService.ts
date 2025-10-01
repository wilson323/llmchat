import fs from 'fs/promises';
import path from 'path';
import { AgentConfig, Agent, AgentStatus, AgentHealthStatus } from '@/types';
import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';
import { deepReplaceEnvVariables, validateRequiredEnvVars, containsUnresolvedPlaceholders } from '@/utils/envHelper';

type AgentSeed = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  apiKey: string;
  model: string;
  provider: AgentConfig['provider'];
  capabilities?: string[];
  isActive?: boolean;
  features?: Partial<AgentConfig['features']>;
};

type AgentDbRow = {
  id: string;
  name: string;
  description: string | null;
  provider: AgentConfig['provider'];
  endpoint: string;
  api_key: string;
  app_id: string | null;
  model: string;
  max_tokens: number | null;
  temperature: number | null;
  system_prompt: string | null;
  capabilities: any;
  rate_limit: any;
  features: any;
  metadata: any;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export interface AgentMutationInput {
  id?: string;
  name: string;
  description?: string;
  provider: AgentConfig['provider'];
  endpoint: string;
  apiKey: string;
  appId?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  capabilities?: string[];
  rateLimit?: AgentConfig['rateLimit'];
  features?: AgentConfig['features'];
  isActive?: boolean;
}

/**
 * 智能体配置服务
 * 负责加载、管理和验证智能体配置
 */
export class AgentConfigService {
  private configPath: string;
  private agents: Map<string, AgentConfig> = new Map();
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private loadingPromise: Promise<AgentConfig[]> | null = null;
  private snapshotWriting = false;
  private readonly builtinSeeds: AgentSeed[] = [
    {
      id: 'product-scene-preview',
      name: '产品现场预览 (示例)',
      description: '演示用智能体，请在后台完成正式配置并更新端点/密钥。',
      endpoint: 'https://example.com/agents/product-preview',
      apiKey: 'demo-api-key',
      model: 'demo-product-model',
      provider: 'custom',
      capabilities: ['scene-preview', 'image-compose'],
      isActive: false,
    },
    {
      id: 'voice-conversation-assistant',
      name: '语音通话助手 (示例)',
      description: '演示用智能体，需替换为真实语音模型的访问配置。',
      endpoint: 'https://example.com/agents/voice-call',
      apiKey: 'demo-api-key',
      model: 'demo-voice-model',
      provider: 'custom',
      capabilities: ['speech-to-text', 'text-to-speech'],
      isActive: false,
      features: {
        supportsStream: true,
        supportsDetail: true,
        streamingConfig: {
          enabled: true,
          endpoint: 'same' as const,
          statusEvents: true,
          flowNodeStatus: false,
        },
      },
    },
  ];

  constructor(configPath?: string) {
    this.configPath = configPath ||
      process.env.AGENTS_CONFIG_PATH ||
      path.join(__dirname, '../../../config/agents.json');
  }

  /**
   * 加载智能体配置
   */
  async loadAgents(): Promise<AgentConfig[]> {
    return this.ensureCache();
  }

  /**
   * 获取特定智能体配置
   */
  async getAgent(id: string): Promise<AgentConfig | null> {
    await this.ensureCache();
    return this.agents.get(id) || null;
  }

  /**
   * 获取可用的智能体列表（简化版本，用于前端显示）
   */
  async getAvailableAgents(): Promise<Agent[]> {
    const configs = await this.ensureCache();

    return configs
      .filter(config => config.isActive)
      .map(config => this.transformToAgent(config));
  }

  /**
   * 获取所有智能体（包括不可用的）
   */
  async getAllAgents(): Promise<Agent[]> {
    const configs = await this.ensureCache();

    return configs.map(config => this.transformToAgent(config));
  }

  /**
   * 检查智能体健康状态
   */
  async checkAgentHealth(id: string): Promise<AgentHealthStatus> {
    const config = await this.getAgent(id);
    if (!config) {
      return {
        agentId: id,
        status: 'error',
        lastChecked: new Date().toISOString(),
        error: '智能体不存在',
      };
    }

    const startTime = Date.now();
    let status: AgentStatus = 'inactive';
    let error: string | undefined;

    try {
      // 这里可以实现具体的健康检查逻辑
      // 例如发送一个简单的请求到智能体端点
      if (config.isActive) {
        status = 'active';
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : '健康检查失败';
    }

    const result: AgentHealthStatus = {
      agentId: id,
      status,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
    };

    if (error) {
      result.error = error;
    }

    return result;
  }

  /**
   * 更新智能体配置
   */
  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<void> {
    await this.ensureCache();
    const config = await this.getAgent(id);
    if (!config) {
      throw new Error(`智能体不存在: ${id}`);
    }

    const updatedConfig: AgentConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (!this.validateAgentConfig(updatedConfig, id)) {
      throw new Error('更新后的配置验证失败');
    }

    await this.persistAgent(updatedConfig);
  }

  async createAgent(input: AgentMutationInput): Promise<AgentConfig> {
    await this.ensureCache();
    const id = input.id || generateId().replace(/-/g, '');
    const now = new Date().toISOString();
    const baseFeatures = this.ensureFeatureDefaults(input.features);

    const config: AgentConfig = {
      id,
      name: input.name,
      description: input.description || '',
      endpoint: input.endpoint,
      apiKey: input.apiKey,
      model: input.model,
      capabilities: input.capabilities ?? [],
      provider: input.provider,
      isActive: input.isActive ?? true,
      features: baseFeatures,
      createdAt: now,
      updatedAt: now,
      ...(input.appId ? { appId: input.appId } : {}),
      ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
      ...(input.rateLimit ? { rateLimit: input.rateLimit } : {}),
    };

    if (!this.validateAgentConfig(config)) {
      throw new Error('智能体配置验证失败');
    }

    await this.insertAgent(config);
    return config;
  }

  async deleteAgent(id: string): Promise<void> {
    await this.ensureCache();
    await withClient(async (client) => {
      await client.query('DELETE FROM agent_configs WHERE id = $1', [id]);
    });
    this.agents.delete(id);
    await this.writeSnapshotToFile();
  }

  async importAgents(inputs: AgentMutationInput[]): Promise<AgentConfig[]> {
    const results: AgentConfig[] = [];
    for (const input of inputs) {
      await this.ensureCache();
      const id = input.id || generateId().replace(/-/g, '');
      const existed = await this.getAgent(id);
      if (existed) {
        await this.updateAgent(id, input as Partial<AgentConfig>);
        const latest = await this.getAgent(id);
        if (latest) results.push(latest);
      } else {
        const created = await this.createAgent({ ...input, id });
        results.push(created);
      }
    }
    return results;
  }

  async reloadAgents(): Promise<AgentConfig[]> {
    this.agents.clear();
    this.lastLoadTime = 0;
    return this.ensureCache(true);
  }

  private async ensureCache(force = false): Promise<AgentConfig[]> {
    const now = Date.now();
    if (!force && this.agents.size > 0 && now - this.lastLoadTime < this.CACHE_TTL) {
      return Array.from(this.agents.values());
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.loadAgentsFromDb()
        .catch(async (error) => {
          if (this.isTransientDbError(error)) {
            console.warn('[AgentConfigService] 数据库不可用，回退到文件加载:', error instanceof Error ? error.message : error);
            return this.loadAgentsFromFileOnly();
          }

          this.agents.clear();
          this.lastLoadTime = 0;
          throw error;
        })
        .finally(() => {
          this.loadingPromise = null;
        });
    }

    return this.loadingPromise;
  }

  private isTransientDbError(error: unknown): boolean {
    if (!error) {
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    return [
      'DB_NOT_INITIALIZED',
      'DATABASE_CONFIG_MISSING',
      'ECONNREFUSED',
      'ENOTFOUND',
      'timeout'
    ].some((token) => message.includes(token));
  }

  private async loadAgentsFromDb(): Promise<AgentConfig[]> {
    const rows = await withClient(async (client) => {
      const result = await client.query<AgentDbRow>(
        'SELECT * FROM agent_configs ORDER BY created_at ASC'
      );
      return result.rows;
    });

    if (!rows || rows.length === 0) {
      // 如果数据库为空，尝试从文件加载后写入数据库
      await this.backfillFromFile();
      const retryRows = await withClient(async (client) => {
        const result = await client.query<AgentDbRow>(
          'SELECT * FROM agent_configs ORDER BY created_at ASC'
        );
        return result.rows;
      });
      return this.applyCacheFromRows(retryRows);
    }

    return this.applyCacheFromRows(rows);
  }

  private async loadAgentsFromFileOnly(): Promise<AgentConfig[]> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      const sanitized = this.sanitizeNumericPlaceholders(raw);
      const parsed = JSON.parse(sanitized);
      const list = Array.isArray(parsed?.agents) ? parsed.agents : [];
      const replaced = deepReplaceEnvVariables(list) as Array<Partial<AgentConfig> & Record<string, any>>;

      const map = new Map<string, AgentConfig>();
      const fallbackTimestamp = new Date().toISOString();

      for (const item of replaced) {
        if (!item) {
          continue;
        }

        const config: AgentConfig = {
          id: String(item.id || ''),
          name: String(item.name || ''),
          description: String(item.description || ''),
          endpoint: String(item.endpoint || ''),
          apiKey: String(item.apiKey || ''),
          provider: (item.provider as AgentConfig['provider']) || 'custom',
          model: String(item.model || 'unknown-model'),
          capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
          isActive: item.isActive ?? true,
          features: this.ensureFeatureDefaults(item.features as AgentConfig['features'] | undefined),
          createdAt: item.createdAt ? String(item.createdAt) : fallbackTimestamp,
          updatedAt: item.updatedAt ? String(item.updatedAt) : fallbackTimestamp,
        };

        const appId = item.appId ? String(item.appId) : undefined;
        if (appId) {
          config.appId = appId;
        }

        if (typeof item.maxTokens === 'number') {
          config.maxTokens = item.maxTokens;
        }

        if (typeof item.temperature === 'number') {
          config.temperature = item.temperature;
        }

        if (item.systemPrompt) {
          config.systemPrompt = String(item.systemPrompt);
        }

        if (item.rateLimit && typeof item.rateLimit === 'object') {
          config.rateLimit = {
            requestsPerMinute: Number((item.rateLimit as any).requestsPerMinute ?? 0),
            tokensPerMinute: Number((item.rateLimit as any).tokensPerMinute ?? 0),
          };
        }

        if (!this.validateAgentConfig(config, undefined, map)) {
          continue;
        }

        map.set(config.id, config);
      }

      if (map.size === 0) {
        console.warn('[AgentConfigService] 未能从配置文件加载有效的智能体，使用内置示例配置');
        return this.loadDefaultAgentsInMemory();
      }

      this.agents = map;
      this.lastLoadTime = Date.now();
      return Array.from(map.values());
    } catch (error) {
      console.warn('[AgentConfigService] 读取配置文件失败，使用内置示例配置:', error);
      return this.loadDefaultAgentsInMemory();
    }
  }

  private sanitizeNumericPlaceholders(source: string): string {
    return source.replace(/:\s*\$\{[^}]+\}/g, ': 0');
  }

  private applyCacheFromRows(rows: AgentDbRow[]): AgentConfig[] {
    this.agents.clear();
    const configs = rows.map((row) => this.mapRowToConfig(row));
    configs.forEach((cfg) => this.agents.set(cfg.id, cfg));
    this.lastLoadTime = Date.now();
    return configs;
  }

  private loadDefaultAgentsInMemory(): AgentConfig[] {
    const now = new Date().toISOString();
    const map = new Map<string, AgentConfig>();

    for (const seed of this.builtinSeeds) {
      const config: AgentConfig = {
        id: seed.id,
        name: seed.name,
        description: seed.description,
        endpoint: seed.endpoint,
        apiKey: seed.apiKey,
        provider: seed.provider,
        model: seed.model,
        capabilities: seed.capabilities ?? [],
        isActive: seed.isActive ?? false,
        features: this.ensureFeatureDefaults(seed.features as AgentConfig['features'] | undefined),
        createdAt: now,
        updatedAt: now,
      };

      if (!this.validateAgentConfig(config, undefined, map)) {
        continue;
      }

      map.set(config.id, config);
    }

    this.agents = map;
    this.lastLoadTime = Date.now();
    return Array.from(map.values());
  }

  private mapRowToConfig(row: AgentDbRow): AgentConfig {
    const features = this.ensureFeatureDefaults(row.features || {});
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      endpoint: row.endpoint,
      apiKey: row.api_key,
      model: row.model,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
      provider: row.provider,
      isActive: row.is_active,
      features,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      ...(row.app_id ? { appId: row.app_id } : {}),
      ...(row.max_tokens !== null && row.max_tokens !== undefined ? { maxTokens: row.max_tokens } : {}),
      ...(row.temperature !== null && row.temperature !== undefined ? { temperature: row.temperature } : {}),
      ...(row.system_prompt !== null && row.system_prompt !== undefined ? { systemPrompt: row.system_prompt } : {}),
      ...(row.rate_limit ? { rateLimit: row.rate_limit } : {}),
    };
  }

  private ensureFeatureDefaults(features: AgentConfig['features'] | undefined): AgentConfig['features'] {
    const streamingConfig = (features?.streamingConfig ?? {}) as Partial<AgentConfig['features']['streamingConfig']>;
    return {
      supportsChatId: features?.supportsChatId ?? true,
      supportsStream: features?.supportsStream ?? true,
      supportsDetail: features?.supportsDetail ?? true,
      supportsFiles: features?.supportsFiles ?? true,
      supportsImages: features?.supportsImages ?? false,
      streamingConfig: {
        enabled: streamingConfig?.enabled ?? true,
        endpoint: streamingConfig?.endpoint ?? 'same',
        statusEvents: streamingConfig?.statusEvents ?? true,
        flowNodeStatus: streamingConfig?.flowNodeStatus ?? true,
      },
    };
  }

  private async persistAgent(config: AgentConfig): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `UPDATE agent_configs SET
          name = $1,
          description = $2,
          provider = $3,
          endpoint = $4,
          api_key = $5,
          app_id = $6,
          model = $7,
          max_tokens = $8,
          temperature = $9,
          system_prompt = $10,
          capabilities = $11::jsonb,
          rate_limit = $12::jsonb,
          features = $13::jsonb,
          metadata = COALESCE(metadata, '{}'::jsonb),
          is_active = $14,
          updated_at = NOW()
        WHERE id = $15`,
        [
          config.name,
          config.description,
          config.provider,
          config.endpoint,
          config.apiKey,
          config.appId || null,
          config.model,
          config.maxTokens ?? null,
          config.temperature ?? null,
          config.systemPrompt ?? null,
          JSON.stringify(config.capabilities ?? []),
          JSON.stringify(config.rateLimit ?? null),
          JSON.stringify(config.features ?? null),
          config.isActive,
          config.id,
        ]
      );
    });
    this.agents.set(config.id, config);
    await this.writeSnapshotToFile();
  }

  private async insertAgent(config: AgentConfig): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO agent_configs (
          id, name, description, provider, endpoint, api_key, app_id,
          model, max_tokens, temperature, system_prompt, capabilities,
          rate_limit, features, metadata, is_active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12::jsonb,
          $13::jsonb,$14::jsonb,$15::jsonb,$16
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          provider = EXCLUDED.provider,
          endpoint = EXCLUDED.endpoint,
          api_key = EXCLUDED.api_key,
          app_id = EXCLUDED.app_id,
          model = EXCLUDED.model,
          max_tokens = EXCLUDED.max_tokens,
          temperature = EXCLUDED.temperature,
          system_prompt = EXCLUDED.system_prompt,
          capabilities = EXCLUDED.capabilities,
          rate_limit = EXCLUDED.rate_limit,
          features = EXCLUDED.features,
          metadata = EXCLUDED.metadata,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();`,
        [
          config.id,
          config.name,
          config.description,
          config.provider,
          config.endpoint,
          config.apiKey,
          config.appId || null,
          config.model,
          config.maxTokens ?? null,
          config.temperature ?? null,
          config.systemPrompt ?? null,
          JSON.stringify(config.capabilities ?? []),
          JSON.stringify(config.rateLimit ?? null),
          JSON.stringify(config.features ?? null),
          JSON.stringify({ source: 'db' }),
          config.isActive,
        ]
      );
    });
    this.agents.set(config.id, config);
    await this.writeSnapshotToFile();
  }

  private async backfillFromFile(): Promise<void> {
    let seededFromFile = false;
    try {
      const file = await fs.readFile(this.configPath, 'utf-8');
      const sanitized = this.sanitizeNumericPlaceholders(file);
      const parsed = JSON.parse(sanitized);
      let list: AgentConfig[] = Array.isArray(parsed?.agents) ? parsed.agents : [];

      // 🔐 安全增强：环境变量替换
      list = deepReplaceEnvVariables(list) as AgentConfig[];

      if (list.length > 0) {
        for (const agent of list) {
          if (this.validateAgentConfig(agent)) {
            await this.insertAgent({
              ...agent,
              createdAt: agent.createdAt || new Date().toISOString(),
              updatedAt: agent.updatedAt || new Date().toISOString(),
            });
            seededFromFile = true;
          }
        }
      }
    } catch (error) {
      console.warn('从文件回填智能体失败:', error);
    }

    if (!seededFromFile && this.agents.size === 0) {
      await this.seedDefaultAgents();
    }
  }

  private async seedDefaultAgents(): Promise<void> {
    const now = new Date().toISOString();
    for (const seed of this.builtinSeeds) {
      const features = this.ensureFeatureDefaults(seed.features as AgentConfig['features'] | undefined);
      const config: AgentConfig = {
        id: seed.id,
        name: seed.name,
        description: seed.description,
        endpoint: seed.endpoint,
        apiKey: seed.apiKey,
        model: seed.model,
        provider: seed.provider,
        isActive: seed.isActive ?? false,
        capabilities: seed.capabilities ?? [],
        features,
        createdAt: now,
        updatedAt: now,
      };

      if (this.validateAgentConfig(config)) {
        await this.insertAgent(config);
      }
    }
  }

  private async writeSnapshotToFile(): Promise<void> {
    if (this.snapshotWriting) return;
    this.snapshotWriting = true;
    try {
      const config = {
        agents: Array.from(this.agents.values()),
      };
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.warn('写入智能体快照失败:', error);
    } finally {
      this.snapshotWriting = false;
    }
  }

  private validateAgentConfig(
    config: any,
    existingId?: string,
    collection: Map<string, AgentConfig> = this.agents
  ): config is AgentConfig {
    const requiredFields = ['id', 'name', 'description', 'endpoint', 'apiKey', 'model', 'provider'];

    for (const field of requiredFields) {
      if (!config[field]) {
        console.error(`智能体配置缺少必需字段: ${field}`);
        return false;
      }
    }

    // 🔐 安全检查：确保没有未解析的环境变量占位符
    const sensitiveFields = ['endpoint', 'apiKey', 'appId'];
    for (const field of sensitiveFields) {
      if (config[field] && typeof config[field] === 'string' && containsUnresolvedPlaceholders(config[field])) {
        console.error(`智能体配置包含未解析的环境变量占位符: ${field} = ${config[field]}`);
        return false;
      }
    }

    if (collection.has(config.id) && config.id !== existingId) {
      console.error(`智能体ID重复: ${config.id}`);
      return false;
    }

    if (config.provider === 'fastgpt') {
      if (!config.appId || typeof config.appId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(config.appId)) {
        console.error(`FastGPT 配置缺少有效的 appId（需要 24 位十六进制字符串）: ${config.id}`);
        return false;
      }
    }

    const validProviders = ['fastgpt', 'openai', 'anthropic', 'custom'];
    if (!validProviders.includes(config.provider)) {
      console.error(`不支持的provider: ${config.provider}`);
      return false;
    }

    try {
      const endpointUrl = config.endpoint.startsWith('http')
        ? config.endpoint
        : `https://${config.endpoint}`;
      new URL(endpointUrl);
    } catch {
      console.error(`无效的endpoint URL: ${config.endpoint}`);
      return false;
    }

    return true;
  }

  private transformToAgent(config: AgentConfig): Agent {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      model: config.model,
      status: config.isActive ? 'active' : 'inactive',
      capabilities: config.capabilities,
      provider: config.provider,
    };
  }
}
