import { api } from './api';
import type { ApiSuccessPayload } from '@/types/dynamic';

export interface AgentItem {
  id: string;
  name: string;
  description?: string;
  model?: string;
  status?: 'active' | 'inactive';
  provider?: string;
  capabilities?: string[];
  features?: Record<string, any>;
  rateLimit?: { requestsPerMinute?: number; tokensPerMinute?: number };
  endpoint?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  appId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentPayload {
  id?: string;
  name: string;
  description?: string;
  provider: string;
  endpoint: string;
  apiKey: string;
  appId?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  capabilities?: string[];
  rateLimit?: { requestsPerMinute?: number; tokensPerMinute?: number };
  isActive?: boolean;
  features?: Record<string, any>;
}

export async function listAgents(opts?: { includeInactive?: boolean }): Promise<AgentItem[]> {
  const { data } = await api.get<ApiSuccessPayload<AgentItem[]>>(
    '/agents',
    { params: { includeInactive: opts?.includeInactive ? 'true' : undefined } },
  );
  return data.data;
}

export async function reloadAgents(): Promise<{ totalAgents: number; activeAgents: number }> {
  const { data } = await api.post<ApiSuccessPayload<{ totalAgents: number; activeAgents: number }>>(
    '/agents/reload',
    {},
  );
  return data.data;
}

export async function updateAgent(id: string, updates: Partial<AgentPayload>): Promise<AgentItem> {
  const { data } = await api.put<ApiSuccessPayload<AgentItem>>(`/agents/${id}`, updates);
  return data.data;
}

export async function createAgent(payload: AgentPayload): Promise<AgentItem> {
  const { data } = await api.post<ApiSuccessPayload<AgentItem>>('/agents', payload);
  return data.data;
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`);
}

export async function importAgents(payload: { agents: AgentPayload[] }): Promise<AgentItem[]> {
  const { data } = await api.post<ApiSuccessPayload<AgentItem[]>>('/agents/import', payload);
  return data.data;
}

export async function validateAgent(id: string): Promise<{ agentId: string; isValid: boolean; exists: boolean; isActive: boolean }> {
  const { data } = await api.get<ApiSuccessPayload<{ agentId: string; isValid: boolean; exists: boolean; isActive: boolean }>>(
    `/agents/${id}/validate`,
  );
  return data.data;
}

export interface FetchAgentInfoParams {
  provider: 'fastgpt' | 'dify';
  endpoint: string;
  apiKey: string;
  appId?: string;
}

export interface AgentInfo {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  capabilities: Array<string>;
  features: Record<string, any>;
}

export async function fetchAgentInfo(params: FetchAgentInfoParams): Promise<ApiSuccessPayload<AgentInfo>> {
  const { data } = await api.post<ApiSuccessPayload<AgentInfo>>('/agents/fetch-info', params);
  return data;
}
