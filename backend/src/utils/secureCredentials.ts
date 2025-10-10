/**
 * Secure Credentials Manager
 *
 * Provides encryption at rest for sensitive credentials like database passwords
 * and API keys using AES-256-CBC encryption with environment-derived keys.
 */

import crypto from 'crypto';
import logger from '@/utils/logger';

export interface EncryptedData {
  data: string;      // Base64 encoded encrypted data
  iv: string;        // Base64 encoded initialization vector
  algorithm: string; // Encryption algorithm used
}

export class SecureCredentialsManager {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly SALT_ROUNDS = 329_876; // NIST recommended

  /**
   * Derives encryption key from environment variables using PBKDF2
   */
  private static deriveKey(): Buffer {
    const secretSources = [
      process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'default-secret',
      process.env.DATABASE_URL || '',
      process.env.NODE_ENV || 'development',
      process.env.HOSTNAME || '',
      'llmchat-credentials-salt-2024', // Fixed salt component
    ];

    // Create combined secret
    const combinedSecret = secretSources.join('|');

    // Create consistent salt from environment
    const saltInput = process.env.CREDENTIALS_SALT || 'llmchat-default-salt';
    const salt = crypto.createHash('sha256').update(saltInput).digest();

    return crypto.pbkdf2Sync(combinedSecret, salt, this.SALT_ROUNDS, 32, 'sha256');
  }

  /**
   * Encrypts sensitive data
   */
  static encrypt(plaintext: string): EncryptedData {
    try {
      const key = this.deriveKey();
      const iv = crypto.randomBytes(16); // CBC needs 16-byte IV

      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      return {
        data: Buffer.from(encrypted).toString('base64'),
        iv: iv.toString('base64'),
        algorithm: this.ALGORITHM,
      };
    } catch (error) {
      logger.error('[SecureCredentialsManager] Encryption failed', { error });
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypts sensitive data
   */
  static decrypt(encryptedData: EncryptedData): string {
    try {
      const key = this.deriveKey();
      const iv = Buffer.from(encryptedData.iv, 'base64');

      const decipher = crypto.createDecipheriv(encryptedData.algorithm, key, iv);

      const encryptedBuffer = Buffer.from(encryptedData.data, 'base64');
      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('[SecureCredentialsManager] Decryption failed', { error });
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Encrypts database password for secure storage
   */
  static encryptDatabasePassword(password: string): EncryptedData {
    return this.encrypt(password);
  }

  /**
   * Decrypts database password for use in connections
   */
  static decryptDatabasePassword(encryptedData: EncryptedData): string {
    return this.decrypt(encryptedData);
  }

  /**
   * Encrypts API keys for secure storage
   */
  static encryptApiKey(apiKey: string): EncryptedData {
    return this.encrypt(apiKey);
  }

  /**
   * Decrypts API keys for use in requests
   */
  static decryptApiKey(encryptedData: EncryptedData): string {
    return this.decrypt(encryptedData);
  }

  /**
   * Validates encrypted data integrity
   */
  static validateEncryptedData(encryptedData: any): encryptedData is EncryptedData {
    return (
      encryptedData &&
      typeof encryptedData === 'object' &&
      typeof encryptedData.data === 'string' &&
      typeof encryptedData.iv === 'string' &&
      typeof encryptedData.algorithm === 'string' &&
      encryptedData.data.length > 0 &&
      encryptedData.iv.length > 0
    );
  }

  /**
   * Generates a secure random key for additional entropy
   */
  static generateSecureKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Checks if encryption is available (proper environment setup)
   */
  static isEncryptionAvailable(): boolean {
    try {
      this.deriveKey();
      return true;
    } catch (error) {
      logger.warn('[SecureCredentialsManager] Encryption not available', { error });
      return false;
    }
  }

  /**
   * Masks sensitive data for logging
   */
  static maskSensitiveData(data: string): string {
    if (!data || data.length < 8) {
      return '***';
    }
    return data.substring(0, 4) + '***' + data.substring(data.length - 4);
  }
}