import bcrypt from 'bcryptjs';
import { ValidationError, SystemError } from '@/types/errors';

/**
 * 密码强度检查结果
 */
export interface PasswordStrengthResult {
  valid: boolean;
  score: number; // 0-4
  feedback: Array<string>;
}

/**
 * 密码服务
 * 提供密码散列、验证和强度检查功能
 */
export class PasswordService {
  private readonly saltRounds = 12;
  private readonly minLength = 8;
  private readonly maxLength = 128;

  /**
   * 散列密码
   * @param plainPassword 明文密码
   * @returns 散列后的密码
   */
  async hashPassword(plainPassword: string): Promise<string> {
    this.validatePasswordFormat(plainPassword);
    const salt = await bcrypt.genSalt(this.saltRounds);
    return bcrypt.hash(plainPassword, salt);
  }

  /**
   * 验证密码
   * @param plainPassword 明文密码
   * @param hashedPassword 散列密码
   * @returns 验证结果
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new SystemError({
        message: 'Password verification failed',
        code: 'PASSWORD_VERIFY_ERROR',
        originalError: error
      });
    }
  }

  /**
   * 检查密码强度
   * @param password 密码
   * @returns 强度检查结果
   */
  checkPasswordStrength(password: string): PasswordStrengthResult {
    const feedback: Array<string> = [];
    let score = 0;

    // 长度检查
    if (password.length < this.minLength) {
      feedback.push(`密码长度至少 ${this.minLength} 位`);
    } else if (password.length >= this.minLength) {
      score++;
    }

    // 复杂度检查
    if (!/[a-z]/.test(password)) {
      feedback.push('至少包含一个小写字母');
    } else {
      score++;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('至少包含一个大写字母');
    } else {
      score++;
    }

    if (!/[0-9]/.test(password)) {
      feedback.push('至少包含一个数字');
    } else {
      score++;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push('建议包含特殊字符以增强安全性');
    } else {
      score++;
    }

    // 常见弱密码检查
    const weakPasswords = ['password', '12345678', 'qwerty', 'admin123', 'password123'];
    if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
      feedback.push('密码过于简单,请避免使用常见密码');
      score = Math.max(0, score - 2);
    }

    return {
      valid: score >= 3,
      score: Math.min(4, score),
      feedback
    };
  }

  /**
   * 格式验证
   * @param password 密码
   */
  private validatePasswordFormat(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new ValidationError({
        message: 'Password must be a non-empty string',
        code: 'INVALID_PASSWORD_FORMAT'
      });
    }

    if (password.length < this.minLength || password.length > this.maxLength) {
      throw new ValidationError({
        message: `Password length must be between ${this.minLength} and ${this.maxLength} characters`,
        code: 'INVALID_PASSWORD_LENGTH'
      });
    }
  }
}

// 导出单例实例
export const passwordService = new PasswordService();

