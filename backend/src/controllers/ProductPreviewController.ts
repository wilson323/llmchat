import type { Request, Response } from 'express';
import Joi from 'joi';
import { ProductPreviewService } from '@/services/ProductPreviewService';
import type { ApiError, ProductPreviewRequest } from '@/types';
import logger from '@/utils/logger';
import { ApiResponseHandler } from '@/utils/apiResponse';

export class ProductPreviewController {
  private readonly service: ProductPreviewService;

  constructor() {
    this.service = new ProductPreviewService();
  }

  private readonly generateSchema = Joi.object<ProductPreviewRequest>({
    sceneImage: Joi.string().min(10).required().messages({
      'any.required': '现场照片不能为空',
      'string.empty': '现场照片不能为空',
    }),
    productImage: Joi.string().min(10).optional().allow('', null),
    productQuery: Joi.string().min(1).required().messages({
      'any.required': '产品查询不能为空',
      'string.empty': '产品查询不能为空',
    }),
    personalization: Joi.string().allow('', null).optional(),
    boundingBox: Joi.object({
      x: Joi.number().min(0).max(1).required(),
      y: Joi.number().min(0).max(1).required(),
      width: Joi.number().min(0).max(1).required(),
      height: Joi.number().min(0).max(1).required(),
    }).required().messages({
      'any.required': '请标记现场红框区域',
    }),
  });

  generatePreview = async (req: Request, res: Response): Promise<void> => {
    const { error, value } = this.generateSchema.validate(req.body, { abortEarly: false, allowUnknown: false });

    if (error) {
      const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: error.details.map((detail) => detail.message).join('；'),
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(apiError);
      return;
    }

    try {
      const result = await this.service.generatePreview(value);
      ApiResponseHandler.sendSuccess(res, result, {
        message: '生成现场预览成功',
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    } catch (err: unknown) {
      logger.error('调用豆包图片生成接口失败', { error: err });
      const errResp = (err as {response?: {data?: {message?: string}}; message?: string});
      const apiError: ApiError = {
        code: 'DOUBAO_IMAGE_GENERATE_FAILED',
        message: errResp?.response?.data?.message ?? errResp?.message ?? '生成现场预览失败',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? errResp?.response?.data ?? err : undefined,
      };
      res.status(500).json(apiError);
    }
  };
}
