/**
 * 安全JWT工具
 * 提供JWT令牌的安全创建和验证功能
 */

import jwt, { Algorithm, SignOptions } from 'jsonwebtoken';
import { LogSanitizer } from './logSanitizer';

export interface JWTPayload {
  userId: string;
  email: string;
  sub?: string;
  username?: string;
  role?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export class SecureJWT {
  private static readonly DEFAULT_ALGORITHM = 'HS256';
  private static readonly DEFAULT_EXPIRES_IN = '1h';

  static getConfig(): {
    secret: string;
    algorithm: jwt.Algorithm;
    expiresIn: string;
    issuer: string;
    audience: string;
    } {
    const secret = process.env.TOKEN_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('TOKEN_SECRET must be at least 32 characters long');
    }

    return {
      secret,
      algorithm: (process.env.JWT_ALGORITHM as jwt.Algorithm) || this.DEFAULT_ALGORITHM,
      expiresIn: process.env.JWT_EXPIRES_IN || this.DEFAULT_EXPIRES_IN,
      issuer: process.env.JWT_ISSUER || 'llmchat-backend',
      audience: process.env.JWT_AUDIENCE || 'llmchat-frontend',
    };
  }

  static validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.getConfig();

    try {
      if (config.secret.length < 32) {
        errors.push('TOKEN_SECRET must be at least 32 characters long');
      }

      if (!['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'].includes(config.algorithm)) {
        errors.push(`Unsupported JWT algorithm: ${config.algorithm}`);
      }

      // Test token creation
      const testPayload = { test: 'validation' };
      jwt.sign(testPayload, config.secret, { algorithm: config.algorithm });
    } catch (error) {
      errors.push(`JWT configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static createToken(payload: JWTPayload): string {
    const config = this.getConfig();

      const options: jwt.SignOptions = {
      issuer: config.issuer,
      audience: config.audience,
      algorithm: config.algorithm as jwt.Algorithm,
    };

    // expiresIn is handled separately to avoid type issues
    if (config.expiresIn) {
      (options as any).expiresIn = config.expiresIn;
    }

    return jwt.sign(payload, config.secret, options);
  }

  static isTokenRevoked(token: string): boolean {
    // 这里可以实现token撤销检查逻辑
    // 例如检查黑名单或数据库记录
    return false;
  }

  static getTokenTTL(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded?.exp || !decoded.iat) {
      return 0;
    }
    return decoded.exp - decoded.iat;
  }

  static verifyToken(token: string): JWTPayload {
    const config = this.getConfig();

    try {
      const decoded = jwt.verify(token, config.secret, {
        algorithms: [config.algorithm],
        issuer: config.issuer,
        audience: config.audience,
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  static refreshToken(token: string): string {
    const decoded = this.verifyToken(token);
    const { iat, exp, ...payload } = decoded;
    return this.createToken(payload);
  }

  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded?.exp) {
        return true;
      }

      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  static sanitizeLogMessage(message: string): string {
    return LogSanitizer.sanitize(message);
  }
}