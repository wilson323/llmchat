/**
 * Performance Testing Configuration
 *
 * Defines performance thresholds, test parameters, and monitoring settings.
 */

export interface PerformanceThresholds {
  responseTime: {
    excellent: number;  // ms
    good: number;        // ms
    acceptable: number;  // ms
    poor: number;        // ms
  };
  successRate: {
    excellent: number; // %
    good: number;       // %
    acceptable: number; // %
  };
  throughput: {
    min: number; // requests per second
    target: number; // requests per second
  };
}

export interface EndpointConfig {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  thresholds: PerformanceThresholds;
  testParams?: {
    payload?: any;
    headers?: Record<string, string>;
    timeout?: number;
  };
  warmupRequests?: number;
  testRequests?: number;
  concurrentRequests?: number;
}

export const PERFORMANCE_CONFIG = {
  // Global performance thresholds
  globalThresholds: {
    responseTime: {
      excellent: 50,   // < 50ms is excellent
      good: 100,       // < 100ms is good
      acceptable: 200, // < 200ms is acceptable
      poor: 500        // > 500ms is poor
    },
    successRate: {
      excellent: 99.9, // > 99.9% success rate
      good: 99.0,      // > 99.0% success rate
      acceptable: 95.0, // > 95.0% success rate
    },
    throughput: {
      min: 10,    // Minimum 10 req/s
      target: 50  // Target 50 req/s
    }
  },

  // Test execution settings
  testSettings: {
    defaultTimeout: 10000,  // 10 seconds
    defaultRequests: 10,    // Default number of requests per test
    defaultConcurrent: 5,   // Default concurrent requests
    warmupRequests: 3,       // Number of warmup requests
    reportFormat: 'json',    // Report output format
    enableTracing: true,      // Enable request tracing
    enableMemoryProfiling: true, // Enable memory profiling
  },

  // Endpoint-specific configurations
  endpoints: [
    // Authentication endpoints
    {
      name: 'auth.login',
      method: 'POST',
      path: '/api/auth/login',
      thresholds: {
        responseTime: { excellent: 100, good: 200, acceptable: 300, poor: 500 },
        successRate: { excellent: 99.0, good: 95.0, acceptable: 90.0 },
        throughput: { min: 5, target: 20 }
      },
      testParams: {
        payload: {
          email: 'test@example.com',
          password: 'testpassword123'
        },
        timeout: 5000
      },
      warmupRequests: 2,
      testRequests: 10,
      concurrentRequests: 2
    },
    {
      name: 'auth.register',
      method: 'POST',
      path: '/api/auth/register',
      thresholds: {
        responseTime: { excellent: 150, good: 250, acceptable: 400, poor: 600 },
        successRate: { excellent: 99.0, good: 95.0, acceptable: 90.0 },
        throughput: { min: 3, target: 15 }
      },
      testParams: {
        payload: {
          email: `test${Date.now()}@example.com`,
          password: 'testpassword123',
          confirmPassword: 'testpassword123'
        },
        timeout: 5000
      },
      warmupRequests: 2,
      testRequests: 8,
      concurrentRequests: 2
    },

    // Agent management endpoints
    {
      name: 'agents.list',
      method: 'GET',
      path: '/api/agents',
      thresholds: {
        responseTime: { excellent: 30, good: 60, acceptable: 100, poor: 200 },
        successRate: { excellent: 99.9, good: 99.0, acceptable: 95.0 },
        throughput: { min: 20, target: 100 }
      },
      warmupRequests: 2,
      testRequests: 15,
      concurrentRequests: 5
    },
    {
      name: 'agents.status',
      method: 'GET',
      path: '/api/agents/fastgpt/status',
      thresholds: {
        responseTime: { excellent: 20, good: 40, acceptable: 60, poor: 100 },
        successRate: { excellent: 99.9, good: 99.0, acceptable: 95.0 },
        throughput: { min: 25, target: 150 }
      },
      warmupRequests: 2,
      testRequests: 20,
      concurrentRequests: 8
    },

    // Chat endpoints
    {
      name: 'chat.completion',
      method: 'POST',
      path: '/api/chat/completions',
      thresholds: {
        responseTime: { excellent: 1000, good: 2000, acceptable: 3000, poor: 5000 },
        successRate: { excellent: 98.0, good: 95.0, acceptable: 90.0 },
        throughput: { min: 2, target: 10 }
      },
      testParams: {
        payload: {
          agentId: 'fastgpt',
          message: 'Hello, this is a performance test message',
          sessionId: 'perf-test-' + Date.now()
        },
        timeout: 8000
      },
      warmupRequests: 1,
      testRequests: 5,
      concurrentRequests: 2
    },
    {
      name: 'chat.history',
      method: 'GET',
      path: '/api/chat/history/perf-test-session',
      thresholds: {
        responseTime: { excellent: 50, good: 100, acceptable: 150, poor: 300 },
        successRate: { excellent: 99.9, good: 99.0, acceptable: 95.0 },
        throughput: { min: 15, target: 50 }
      },
      warmupRequests: 2,
      testRequests: 12,
      concurrentRequests: 4
    },

    // Admin endpoints
    {
      name: 'admin.stats',
      method: 'GET',
      path: '/api/admin/stats',
      thresholds: {
        responseTime: { excellent: 100, good: 200, acceptable: 300, poor: 500 },
        successRate: { excellent: 99.0, good: 95.0, acceptable: 90.0 },
        throughput: { min: 10, target: 30 }
      },
      warmupRequests: 2,
      testRequests: 8,
      concurrentRequests: 3
    },
    {
      name: 'admin.audit',
      method: 'GET',
      path: '/api/admin/audit',
      thresholds: {
        responseTime: { excellent: 200, good: 400, acceptable: 600, poor: 1000 },
        successRate: { excellent: 99.0, good: 95.0, acceptable: 90.0 },
        throughput: { min: 5, target: 20 }
      },
      warmupRequests: 1,
      testRequests: 6,
      concurrentRequests: 2
    },

    // Queue management endpoints
    {
      name: 'queue.stats',
      method: 'GET',
      path: '/api/queue/stats',
      thresholds: {
        responseTime: { excellent: 30, good: 60, acceptable: 100, poor: 200 },
        successRate: { excellent: 99.9, good: 99.0, acceptable: 95.0 },
        throughput: { min: 20, target: 100 }
      },
      warmupRequests: 2,
      testRequests: 15,
      concurrentRequests: 5
    },
    {
      name: 'queue.pause',
      method: 'POST',
      path: '/api/queue/pause',
      thresholds: {
        responseTime: { excellent: 20, good: 40, acceptable: 60, poor: 100 },
        successRate: { excellent: 99.9, good: 99.0, acceptable: 95.0 },
        throughput: { min: 25, target: 150 }
      },
      testParams: {
        payload: { queueName: 'chat-queue' },
        timeout: 3000
      },
      warmupRequests: 2,
      testRequests: 20,
      concurrentRequests: 8
    }
  ] as EndpointConfig[],

  // Monitoring settings
  monitoring: {
    enableRealTimeMonitoring: true,
    metricsRetentionDays: 30,
    alertThresholds: {
      responseTime: 1000,    // Alert if avg response time > 1000ms
      errorRate: 5.0,      // Alert if error rate > 5%
      memoryUsage: 80,     // Alert if memory usage > 80%
      cpuUsage: 70         // Alert if CPU usage > 70%
    }
  },

  // Reporting settings
  reporting: {
    generateHtmlReport: true,
    generateJsonReport: true,
    generateCsvReport: true,
    includeRequestTraces: false,
    includeMemoryProfiling: false,
    outputDirectory: './performance-reports',
    reportRetentionDays: 90
  }
};

export default PERFORMANCE_CONFIG;