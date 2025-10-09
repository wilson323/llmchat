import { Router } from "express";
import {
  getConfigHealth,
  compareConfigSnapshot,
  cleanupObsoleteConfigs,
  getConfigDetails,
} from "@/controllers/AdminController";
import { adminGuard } from "@/middleware/adminGuard";

const router = Router();

/**
 * 管理接口路由
 * 所有接口都需要管理员权限
 */

// 配置健康状态监控
router.get("/config/health", adminGuard, getConfigHealth);

// 配置快照对比
router.get("/config/compare", adminGuard, compareConfigSnapshot);

// 清理废弃配置
router.post("/config/cleanup", adminGuard, cleanupObsoleteConfigs);

// 获取配置详情
router.get("/config/details", adminGuard, getConfigDetails);

export default router;
