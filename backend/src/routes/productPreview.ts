import { Router, type Router as RouterType } from 'express';
import { ProductPreviewController } from '@/controllers/ProductPreviewController';

const router: RouterType = Router();
const controller = new ProductPreviewController();

router.post('/generate', (req, res, next) => {
  controller.generatePreview(req, res, next).catch(next);
});

/**
 * GET /api/product-preview/status
 * 获取产品预览服务状态
 */
router.get('/status', (req, res) => {
  res.json({
    code: 200,
    message: 'success',
    data: {
      service: 'product-preview',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

export const productPreviewRoutes: RouterType = router;
