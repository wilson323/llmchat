// Debug test for error handling
const { VisualizationController } = require('../dist/controllers/VisualizationController');
const { VisualizationConfigService } = require('../dist/services/VisualizationConfigService');
const { VisualizationDataService } = require('../dist/services/VisualizationDataService');
const { QueueManager } = require('../dist/services/QueueManager');
const { MonitoringService } = require('../dist/services/MonitoringService');
const { RedisConnectionPool } = require('../dist/utils/redisConnectionPool');

async function debugTest() {
  console.log('=== Debug Test for Error Handling ===');

  // Create test instances
  const queueManager = QueueManager.getInstance();
  const monitoringService = MonitoringService.getInstance();
  const connectionPool = new RedisConnectionPool();

  const controller = new VisualizationController(queueManager, monitoringService, connectionPool);

  // Mock request and response
  const mockReq = {};
  const mockRes = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    writeHead: jest.fn(),
    write: jest.fn(),
  };

  console.log('1. Testing normal case...');
  try {
    await controller.getQueueStats(mockReq, mockRes);
    console.log('Normal call completed');
    console.log('Status calls:', mockRes.status.mock.calls);
    console.log('JSON calls:', mockRes.json.mock.calls);
  } catch (error) {
    console.log('Error in normal call:', error.message);
  }

  // Reset mocks
  mockRes.status.mockClear();
  mockRes.json.mockClear();

  console.log('2. Testing error case...');

  // Enable the feature
  const configService = controller.getConfigService();
  configService.updateConfig({
    enabled: true,
    features: {
      queueManagement: true,
    },
  });

  // Get the dataService and mock it to throw an error
  const dataService = controller.dataService;
  const originalMethod = dataService.getQueueHistory;
  dataService.getQueueHistory = jest.fn().mockImplementation(() => {
    throw new Error('Test error');
  });

  try {
    await controller.getQueueStats(mockReq, mockRes);
    console.log('Error call completed');
    console.log('Status calls:', mockRes.status.mock.calls);
    console.log('JSON calls:', mockRes.json.mock.calls);
    console.log('Status should be 500:', mockRes.status.mock.calls.length > 0 ? mockRes.status.mock.calls[0][0] : 'No calls');
  } catch (error) {
    console.log('Error in error call:', error.message);
  }

  // Restore original method
  dataService.getQueueHistory = originalMethod;

  console.log('=== Debug Test Complete ===');
}

debugTest().catch(console.error);