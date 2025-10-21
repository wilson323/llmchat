/**
 * Analytics路由 - 数据分析API
 *
 * 提供管理后台的数据分析端点
 */

import { Router, type Router as IRouter } from 'express';
import AnalyticsController from '@/controllers/AnalyticsController';
import { authenticateJWT } from '@/middleware/jwtAuth';
import { adminGuard } from '@/middleware/adminGuard';

const router: IRouter = Router();

// ==================== 认证保护 ====================
// 所有analytics路由都需要管理员权限
router.use(authenticateJWT);
router.use(adminGuard());

// ==================== 系统概览 ====================
/**
 * @route GET /api/admin/analytics/overview
 * @desc 获取系统概览数据
 * @access Admin
 */
router.get('/overview', (req, res, next) => {
  AnalyticsController.getSystemOverview(req, res, next).catch(next);
});

// ==================== 智能体统计 ====================
/**
 * @route GET /api/admin/analytics/agents
 * @desc 获取智能体使用统计
 * @access Admin
 */
router.get('/agents', (req, res, next) => {
  AnalyticsController.getAgentStats(req, res, next).catch(next);
});

// ==================== 趋势分析 ====================
/**
 * @route GET /api/admin/analytics/trends
 * @desc 获取每日趋势数据
 * @access Admin
 * @query {number} days - 查询天数（1-365，默认30）
 */
router.get('/trends', (req, res, next) => {
  AnalyticsController.getDailyTrends(req, res, next).catch(next);
});

// ==================== 地理分布 ====================
/**
 * @route GET /api/admin/analytics/geo
 * @desc 获取地理分布数据
 * @access Admin
 */
router.get('/geo', (req, res, next) => {
  AnalyticsController.getGeoDistribution(req, res, next).catch(next);
});

/**
 * @route GET /api/admin/analytics/province-heatmap
 * @desc 获取省份热力图数据
 * @access Admin
 * @query {string} start - 开始时间
 * @query {string} end - 结束时间
 * @query {string} agentId - 智能体ID（可选）
 */
router.get('/province-heatmap', (req, res, next) => {
  AnalyticsController.getProvinceHeatmap(req, res, next).catch(next);
});

// ==================== 对话分析 ====================
/**
 * @route GET /api/admin/analytics/conversations/series
 * @desc 获取对话系列数据（时间序列）
 * @access Admin
 * @query {string} start - 开始时间
 * @query {string} end - 结束时间
 * @query {string} agentId - 智能体ID（可选）
 */
router.get('/conversations/series', (req, res, next) => {
  AnalyticsController.getConversationSeries(req, res, next).catch(next);
});

/**
 * @route GET /api/admin/analytics/conversations/agents
 * @desc 获取智能体对比数据
 * @access Admin
 * @query {string} start - 开始时间
 * @query {string} end - 结束时间
 */
router.get('/conversations/agents', (req, res, next) => {
  AnalyticsController.getAgentComparison(req, res, next).catch(next);
});

export default router;
