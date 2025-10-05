/**
 * 智能体路由
 * 
 * @swagger
 * tags:
 *   name: Agents
 *   description: 智能体管理接口
 */

import { Router, type Router as RouterType } from 'express';
import { AgentController } from '@/controllers/AgentController';

const router: RouterType = Router();

/**
 * @swagger
 * /api/agents:
 *   get:
 *     summary: 获取所有智能体列表
 *     tags: [Agents]
 *     responses:
 *       200:
 *         description: 成功返回智能体列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: SUCCESS
 *                 message:
 *                   type: string
 *                   example: 获取智能体列表成功
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// 创建控制器实例
const agentController = new AgentController();

router.get('/', agentController.getAgents);

/**
 * @swagger
 * /api/agents/{id}:
 *   get:
 *     summary: 获取指定智能体信息
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 智能体ID
 *     responses:
 *       200:
 *         description: 成功返回智能体信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Agent'
 *       404:
 *         description: 智能体不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id', agentController.getAgentById);

/**
 * @swagger
 * /api/agents/{id}/status:
 *   get:
 *     summary: 检查智能体状态
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 智能体ID
 *     responses:
 *       200:
 *         description: 智能体状态正常
 *       503:
 *         description: 智能体不可用
 */
router.get('/:id/status', agentController.checkAgentStatus);

/**
 * @swagger
 * /api/agents/reload:
 *   post:
 *     summary: 重新加载智能体配置
 *     tags: [Agents]
 *     responses:
 *       200:
 *         description: 配置重新加载成功
 *       500:
 *         description: 重新加载失败
 */
router.post('/reload', agentController.reloadAgents);

/**
 * @swagger
 * /api/agents/{id}/validate:
 *   get:
 *     summary: 验证智能体配置
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 智能体ID
 *     responses:
 *       200:
 *         description: 配置验证成功
 *       400:
 *         description: 配置验证失败
 */
router.get('/:id/validate', agentController.validateAgent);

export default router;
export { router as agentRoutes };