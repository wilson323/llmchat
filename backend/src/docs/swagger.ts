/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Swagger API Documentation Configuration
 * This file contains Swagger/OpenAPI configuration for API documentation.
 */

import { Application, Request, Response, RequestHandler } from 'express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LLM Chat API',
      version: '1.0.0',
      description: 'AI Agent Chat Platform API Documentation',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

// 动态加载可选模块的辅助函数
async function loadOptionalModule<T>(moduleName: string): Promise<T> {
  try {
    const module = await import(moduleName);
    return module.default || module;
  } catch (error) {
    throw new Error(`模块 ${moduleName} 未安装`);
  }
}


export async function setupSwagger(app: Application): Promise<void> {
  try {
    const [swaggerJsdoc, swaggerUi] = await Promise.all([
      loadOptionalModule<any>("swagger-jsdoc"),
      loadOptionalModule<{ serve: RequestHandler; setup: (specs: any, options?: any) => RequestHandler }>(
        "swagger-ui-express"
      ),
    ]);

    const specs = swaggerJsdoc(swaggerOptions);

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "LLMChat API文档",
    }));

    app.get("/api-docs.json", (_req: Request, res: Response) => {
      res.setHeader("Content-Type", "application/json");
      res.send(specs);
    });

    console.log('✅ Swagger API文档已启用');
    console.log('📄 访问地址: http://localhost:3001/api-docs');
  } catch (error) {
    console.warn('⚠️ Swagger依赖未安装，API文档功能已禁用');
    console.warn(
      '💡 运行以下命令安装: pnpm add -D swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express',
    );
  }
}
