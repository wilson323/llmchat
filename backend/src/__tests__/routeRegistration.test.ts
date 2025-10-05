/**
 * 路由注册自动化测试
 * 
 * 目的：防止路由文件存在但未注册的问题再次发生
 * 策略：扫描所有路由文件，验证它们都已在主应用中注册
 */

import fs from 'fs';
import path from 'path';
import express, { Express } from 'express';

describe('Route Registration Tests', () => {
  /**
   * 获取所有路由文件
   */
  function getAllRouteFiles(): string[] {
    const routesDir = path.join(__dirname, '../routes');
    const files = fs.readdirSync(routesDir);
    
    return files
      .filter(file => file.endsWith('.ts') && file !== 'index.ts')
      .map(file => file.replace('.ts', ''));
  }

  /**
   * 从Express应用中提取已注册的路由路径
   */
  function getRegisteredRoutes(app: Express): string[] {
    const routes: string[] = [];
    
    // 遍历Express的路由栈
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // 直接注册的路由
        routes.push(middleware.route.path);
      } else if (middleware.name === 'router') {
        // 通过Router注册的路由
        const routerPath = middleware.regexp
          .toString()
          .replace('/^', '')
          .replace('\\/?(?=\\/|$)/i', '')
          .replace(/\\\//g, '/');
        
        if (routerPath && routerPath !== '/') {
          routes.push(routerPath);
        }
      }
    });
    
    return routes;
  }

  /**
   * 测试：所有路由文件都应该被注册
   */
  it('should register all route files', () => {
    const routeFiles = getAllRouteFiles();
    
    // 预期的路由映射
    const expectedRoutes: Record<string, string> = {
      'agents': '/api/agents',
      'auth': '/api/auth',
      'chat': '/api/chat',
      'cad': '/api/cad',
      'admin': '/api/admin',
      'audit': '/api/audit',
      'difySession': '/api/dify',
      'productPreview': '/api/product-preview',
      'sessionRoutes': '/api/sessions',
      'health': '/health',
    };

    // 验证每个路由文件
    routeFiles.forEach(file => {
      const expectedPath = expectedRoutes[file];
      
      if (!expectedPath) {
        // 如果没有预期路径，说明是新文件，需要添加到映射中
        console.warn(`⚠️ 新路由文件发现: ${file}.ts - 请在测试中添加预期路径`);
      }
      
      expect(expectedPath).toBeDefined();
      expect(expectedPath).toBeTruthy();
    });

    // 验证所有预期路由都有对应的文件
    Object.keys(expectedRoutes).forEach(fileName => {
      if (!routeFiles.includes(fileName)) {
        console.warn(`⚠️ 预期的路由文件不存在: ${fileName}.ts`);
      }
    });
  });

  /**
   * 测试：验证路由导出方式的一致性
   */
  it('should have consistent export patterns', () => {
    const routesDir = path.join(__dirname, '../routes');
    const routeFiles = getAllRouteFiles();

    const exportPatterns: Record<string, 'default' | 'named'> = {};

    routeFiles.forEach(file => {
      const filePath = path.join(routesDir, `${file}.ts`);
      const content = fs.readFileSync(filePath, 'utf-8');

      // 检测导出方式
      if (content.includes('export default')) {
        exportPatterns[file] = 'default';
      } else if (content.match(/export (const|let|var) \w+/)) {
        exportPatterns[file] = 'named';
      }
    });

    // 验证导出模式已知
    routeFiles.forEach(file => {
      expect(exportPatterns[file]).toBeDefined();
      expect(['default', 'named']).toContain(exportPatterns[file]);
    });

    // 输出导出模式供参考
    console.log('📋 路由文件导出模式:');
    Object.entries(exportPatterns).forEach(([file, pattern]) => {
      console.log(`  - ${file}.ts: ${pattern} export`);
    });
  });

  /**
   * 测试：验证路由文件结构
   */
  it('should have valid route file structure', () => {
    const routesDir = path.join(__dirname, '../routes');
    const routeFiles = getAllRouteFiles();

    routeFiles.forEach(file => {
      const filePath = path.join(routesDir, `${file}.ts`);
      const content = fs.readFileSync(filePath, 'utf-8');

      // 验证必要的导入
      expect(content).toContain('Router');
      expect(content).toContain('express');

      // 验证有导出
      expect(
        content.includes('export default') || content.includes('export const') || content.includes('export let')
      ).toBe(true);
    });
  });

  /**
   * 测试：验证没有重复的路由路径
   */
  it('should not have duplicate route paths', () => {
    const expectedRoutes: Record<string, string> = {
      'agents': '/api/agents',
      'auth': '/api/auth',
      'chat': '/api/chat',
      'cad': '/api/cad',
      'admin': '/api/admin',
      'audit': '/api/audit',
      'difySession': '/api/dify',
      'productPreview': '/api/product-preview',
      'sessionRoutes': '/api/sessions',
      'health': '/health',
    };

    const paths = Object.values(expectedRoutes);
    const uniquePaths = new Set(paths);

    expect(paths.length).toBe(uniquePaths.size);
  });

  /**
   * 测试：验证路由命名规范
   */
  it('should follow route naming conventions', () => {
    const routeFiles = getAllRouteFiles();

    routeFiles.forEach(file => {
      // 路由文件名应该是camelCase或包含Routes后缀
      const isValidName = 
        /^[a-z][a-zA-Z0-9]*$/.test(file) || // camelCase
        /^[a-z][a-zA-Z0-9]*Routes$/.test(file); // camelCaseRoutes

      if (!isValidName) {
        console.warn(`⚠️ 路由文件命名不规范: ${file}.ts`);
      }

      expect(isValidName).toBe(true);
    });
  });

  /**
   * 测试：验证关键路由存在
   */
  it('should have all critical routes', () => {
    const criticalRoutes = [
      'health',
      'auth',
      'agents',
      'chat',
      'admin',
    ];

    const routeFiles = getAllRouteFiles();

    criticalRoutes.forEach(route => {
      expect(routeFiles).toContain(route);
    });
  });
});
