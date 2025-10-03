import { Router, type Router as RouterType } from 'express';
import { ProductPreviewController } from '@/controllers/ProductPreviewController';

const router: RouterType = Router();
const controller = new ProductPreviewController();

router.post('/generate', controller.generatePreview);

export const productPreviewRoutes: RouterType = router;
