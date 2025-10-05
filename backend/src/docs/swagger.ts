/**
 * Swagger API文档配置
 *
 * 使用OpenAPI 3.0规范自动生成API文档
 * 访问地址：http://localhost:3001/api-docs
 */

// 注意：需要安装依赖
// pnpm add -D swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express

/**
 * Swagger配置选项
 */
export const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LLMChat API",
      version: "1.0.0",
      description: "多智能体聊天平台 API 文档",
      contact: {
        name: "LLMChat Team",
        email: "support@llmchat.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "开发环境",
      },
      {
        url: "https://api.llmchat.com",
        description: "生产环境",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "使用JWT Token进行认证",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "错误代码",
            },
            message: {
              type: "string",
              description: "错误消息",
            },
            requestId: {
              type: "string",
              description: "请求ID（用于追踪）",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "错误发生时间",
            },
          },
        },
        Agent: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "智能体ID",
            },
            name: {
              type: "string",
              description: "智能体名称",
            },
            provider: {
              type: "string",
              enum: ["fastgpt", "openai", "anthropic", "custom"],
              description: "提供商类型",
            },
            description: {
              type: "string",
              description: "智能体描述",
            },
            capabilities: {
              type: "array",
              items: {
                type: "string",
              },
              description: "智能体能力列表",
            },
          },
        },
        ChatMessage: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["user", "assistant", "system"],
              description: "消息角色",
            },
            content: {
              type: "string",
              description: "消息内容",
            },
          },
        },
        ChatRequest: {
          type: "object",
          required: ["agentId", "messages"],
          properties: {
            agentId: {
              type: "string",
              description: "智能体ID",
            },
            messages: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ChatMessage",
              },
              description: "消息历史",
            },
            stream: {
              type: "boolean",
              default: false,
              description: "是否使用流式响应",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Health",
        description: "健康检查接口",
      },
      {
        name: "Auth",
        description: "认证相关接口",
      },
      {
        name: "Agents",
        description: "智能体管理接口",
      },
      {
        name: "Chat",
        description: "聊天相关接口",
      },
      {
        name: "Admin",
        description: "管理后台接口（需要管理员权限）",
      },
      {
        name: "Audit",
        description: "审计日志接口（需要管理员权限）",
      },
      {
        name: "CAD",
        description: "CAD编辑相关接口",
      },
    ],
  },
  apis: [
    "./src/routes/*.ts", // 扫描所有路由文件
    "./src/controllers/*.ts", // 扫描所有控制器文件
  ],
};

/**
 * 初始化Swagger文档
 *
 * 使用方法：
 * ```typescript
 * import { setupSwagger } from '@/docs/swagger';
 *
 * // 在index.ts中
 * setupSwagger(app);
 * ```
 */
export function setupSwagger(app: any) {
  try {
    // 动态导入（避免在未安装依赖时报错）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // ^ 使用require()动态导入可选依赖，避免在依赖未安装时报错
    const swaggerJsdoc = require("swagger-jsdoc");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // ^ 使用require()动态导入可选依赖，避免在依赖未安装时报错
    const swaggerUi = require("swagger-ui-express");

    const specs = swaggerJsdoc(swaggerOptions);

    // Swagger UI路由
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(specs, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "LLMChat API文档",
      })
    );

    // JSON格式的API文档
    app.get("/api-docs.json", (_req: any, res: any) => {
      res.setHeader("Content-Type", "application/json");
      res.send(specs);
    });

    console.log("✅ Swagger API文档已启用");
    console.log("📄 访问地址: http://localhost:3001/api-docs");
  } catch (error) {
    console.warn("⚠️ Swagger依赖未安装，API文档功能已禁用");
    console.warn(
      "💡 运行以下命令安装: pnpm add -D swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express"
    );
  }
}
