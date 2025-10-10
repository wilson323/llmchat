/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Swagger API Documentation Configuration
 * This file contains Swagger/OpenAPI configuration for API documentation.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

const options = {
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

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Application): void => {
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(specs));
};

export default specs;
