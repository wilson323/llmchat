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
}

export interface AnalyticsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  level?: string;
  source?: string;
}

export interface AgentItem {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
}