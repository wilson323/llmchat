import type { Application, Request, Response, RequestHandler } from "express";
import { loadOptionalModule } from "@/utils/loadOptionalModule";
import { logger } from '@/utils/logger';
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LLMChat API文档",
      version: "2.0.0",
      description: "AI Agent Chat Platform API Documentation",
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3001",
        description: "开发服务器",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export async function setupSwagger(app: Application): Promise<void> {
  try {
    const [swaggerJsdoc, swaggerUi] = await Promise.all([
      loadOptionalModule<any>("swagger-jsdoc"),
      loadOptionalModule<{ serve: RequestHandler; setup: (specs: any, options?: any) => RequestHandler }>(
        "swagger-ui-express"
      ),
    ]);

    const specs = swaggerJsdoc(swaggerOptions);

    if (swaggerUi) {
      app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "LLMChat API文档",
    }));
    }

    app.get("/api-docs.json", (_req: Request, res: Response) => {
      res.setHeader("Content-Type", "application/json");
      res.send(specs);
    });

    logger.debug('✅ Swagger API文档已启用');
    logger.debug('📄 访问地址: http://localhost:3001/api-docs');
  } catch (error: any) {
    logger.warn('⚠️ Swagger依赖未安装，API文档功能已禁用');
    logger.warn(
      '💡 运行以下命令安装: pnpm add -D swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express',
    );
  }
}

