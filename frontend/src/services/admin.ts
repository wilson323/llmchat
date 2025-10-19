
import { AdminStats, LogEntry, SystemMetrics, SecurityAlert, UserActivity } from '@/types/admin';

export const getAdminStats = async (): Promise<AdminStats> => {
  // 模拟API调用
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        totalUsers: 1234,
        activeUsers: 567,
        totalConversations: 8901,
        totalMessages: 45678,
        systemHealth: 'healthy',
        lastBackup: new Date().toISOString(),
      });
    }, 100);
  });
};

export const getLogs = async (page: number = 1, limit: number = 50): Promise<{
  logs: LogEntry[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  // 模拟日志数据
  const logs: LogEntry[] = Array.from({ length: limit }, (_, i) => {
    const sources = ['api', 'auth', 'database', 'queue'];
    const randomIndex = Math.floor(Math.random() * sources.length);
    // 确保source始终是有效的字符串
    const selectedSource = sources[randomIndex] ?? 'system';

    return {
      id: `log-${page}-${i}`,
      timestamp: new Date(Date.now() - i * 60000),
      level: ['info', 'warn', 'error', 'debug'][Math.floor(Math.random() * 4)] as LogEntry['level'],
      message: `Log message ${page}-${i}: System operation completed`,
      source: selectedSource, // 确保始终是字符串，符合 exactOptionalPropertyTypes
      // 使用条件属性展开满足 exactOptionalPropertyTypes
      ...(Math.random() > 0.5 ? {
        metadata: {
          userId: `user-${Math.floor(Math.random() * 1000)}`,
          ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        },
      } : {
        metadata: {
          ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        },
      }),
    };
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        logs,
        total: 1000,
        page,
        totalPages: Math.ceil(1000 / limit),
      });
    }, 50);
  });
};

export const exportLogsCsv = async (_filters?: {
  level?: string;
  source?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<Blob> => {
  // 模拟CSV导出
  const csvContent = 'Timestamp,Level,Message,Source\n2024-01-01T00:00:00Z,info,Test message,api\n';
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(new Blob([csvContent], { type: 'text/csv' }));
    }, 100);
  });
};

export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
        network: {
          inbound: Math.random() * 1000,
          outbound: Math.random() * 1000,
        },
        uptime: Date.now() - 1000 * 60 * 60 * 24 * 7, // 7 days ago
      });
    }, 50);
  });
};

export const getSecurityAlerts = async (): Promise<SecurityAlert[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 'alert-1',
          type: 'suspicious_activity',
          severity: 'medium',
          message: 'Multiple failed login attempts detected',
          timestamp: new Date(Date.now() - 60000),
          resolved: false,
        },
        {
          id: 'alert-2',
          type: 'intrusion',
          severity: 'high',
          message: 'Unusual API access pattern detected',
          timestamp: new Date(Date.now() - 300000),
          resolved: true,
        },
      ]);
    }, 50);
  });
};

export const getUserActivity = async (): Promise<UserActivity[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          userId: 'user-1',
          username: 'admin',
          lastActive: new Date(Date.now() - 60000),
          sessionCount: 5,
          messageCount: 42,
          status: 'active',
        },
        {
          userId: 'user-2',
          username: 'testuser',
          lastActive: new Date(Date.now() - 3600000),
          sessionCount: 2,
          messageCount: 8,
          status: 'inactive',
        },
      ]);
    }, 50);
  });
};