import { api } from './api';

// 会话管理相关类型定义
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  messageCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  metadata?: Record<string, any>;
}

export interface SessionFilter {
  userId?: string;
  agentId?: string;
  status?: Session['status'];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  messageCountMin?: number;
  messageCountMax?: number;
  search?: string;
}

export interface SessionListParams {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
  filter?: SessionFilter;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  totalMessages: number;
  averageMessagesPerSession: number;
  sessionsByDate: Array<{
    date: string;
    count: number;
  }>;
  sessionsByAgent: Array<{
    agentId: string;
    agentName: string;
    sessionCount: number;
    messageCount: number;
  }>;
  topTags: Array<{
    tag: string;
    count: number;
  }>;
}

export interface BatchOperationResult {
  success: number;
  failed: number;
  errors?: Array<{
    sessionId: string;
    error: string;
  }>;
}

// API 函数定义
export async function getSessions(params?: SessionListParams): Promise<SessionListResponse> {
  const { data } = await api.get<SessionListResponse>('/admin/sessions', { params });
  return data;
}

export async function getSession(sessionId: string): Promise<Session> {
  const { data } = await api.get<Session>(`/admin/sessions/${sessionId}`);
  return data;
}

export async function getSessionMessages(sessionId: string, page?: number, pageSize?: number): Promise<{
  messages: SessionMessage[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { data } = await api.get<{
    messages: SessionMessage[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/sessions/${sessionId}/messages`, {
    params: { page, pageSize }
  });
  return data;
}

export async function updateSession(sessionId: string, updates: Partial<Pick<Session, 'title' | 'status' | 'tags' | 'metadata'>>): Promise<Session> {
  const { data } = await api.put<Session>(`/admin/sessions/${sessionId}`, updates);
  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(`/admin/sessions/${sessionId}`);
}

export async function archiveSession(sessionId: string): Promise<Session> {
  const { data } = await api.post<Session>(`/admin/sessions/${sessionId}/archive`);
  return data;
}

export async function unarchiveSession(sessionId: string): Promise<Session> {
  const { data } = await api.post<Session>(`/admin/sessions/${sessionId}/unarchive`);
  return data;
}

export async function getSessionStats(params?: {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
}): Promise<SessionStats> {
  const { data } = await api.get<SessionStats>('/admin/sessions/stats', { params });
  return data;
}

export async function batchDeleteSessions(sessionIds: string[]): Promise<BatchOperationResult> {
  const { data } = await api.post<BatchOperationResult>('/admin/sessions/batch-delete', { sessionIds });
  return data;
}

export async function batchArchiveSessions(sessionIds: string[]): Promise<BatchOperationResult> {
  const { data } = await api.post<BatchOperationResult>('/admin/sessions/batch-archive', { sessionIds });
  return data;
}

export async function batchUnarchiveSessions(sessionIds: string[]): Promise<BatchOperationResult> {
  const { data } = await api.post<BatchOperationResult>('/admin/sessions/batch-unarchive', { sessionIds });
  return data;
}

export async function batchAddTags(sessionIds: string[], tags: string[]): Promise<BatchOperationResult> {
  const { data } = await api.post<BatchOperationResult>('/admin/sessions/batch-add-tags', { sessionIds, tags });
  return data;
}

export async function batchRemoveTags(sessionIds: string[], tags: string[]): Promise<BatchOperationResult> {
  const { data } = await api.post<BatchOperationResult>('/admin/sessions/batch-remove-tags', { sessionIds, tags });
  return data;
}

export async function exportSession(sessionId: string, format: 'json' | 'csv' | 'txt' = 'json'): Promise<string> {
  const { data } = await api.get(`/admin/sessions/${sessionId}/export`, {
    params: { format },
    responseType: 'text'
  });
  return data;
}

export async function exportSessions(params: SessionListParams & { format: 'json' | 'csv' | 'xlsx' }): Promise<string> {
  const { data } = await api.get('/admin/sessions/export', {
    params,
    responseType: 'text'
  });
  return data;
}

export async function searchSessions(query: string, limit?: number): Promise<Session[]> {
  const { data } = await api.get<Session[]>('/admin/sessions/search', {
    params: { query, limit }
  });
  return data;
}