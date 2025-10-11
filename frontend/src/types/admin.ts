export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  systemHealth: 'healthy' | 'warning' | 'error';
  lastBackup?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    inbound: number;
    outbound: number;
  };
  uptime: number;
}

export interface SecurityAlert {
  id: string;
  type: 'intrusion' | 'brute_force' | 'suspicious_activity' | 'data_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface UserActivity {
  userId: string;
  username: string;
  lastActive: Date;
  sessionCount: number;
  messageCount: number;
  status: 'active' | 'inactive' | 'suspended';
}

export interface ProvinceHeatmapDataset {
  province: string;
  value: number;
  lat: number;
  lng: number;
  data?: Array<{
    date: string;
    value: number;
  }>;
  generatedAt?: string;
}

export interface AnalyticsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  level?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  agentId?: string;
}

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
  // 向后兼容
  type?: string;
}