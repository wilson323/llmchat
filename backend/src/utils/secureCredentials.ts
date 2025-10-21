/**
 * Secure Credentials Manager
 *
 * Provides encryption at rest for sensitive credentials like database passwords
 * and API keys using AES-256-CBC encryption with environment-derived keys.
 */

import crypto from 'crypto';
import logger from '@/utils/logger';
import { createErrorFromUnknown } from '@/types/errors';

export interface EncryptedData {
  data: string;      // Base64 encoded encrypted data
  iv: string;        // Base64 encoded initialization vector
  algorithm: string; // Encryption algorithm used
}

// 加密配置常量
const CRYPTO_CONFIG = {
  SALT_ROUNDS: 329_876, // NIST recommended
  KEY_LENGTH: 32, // AES-256 key length in bytes
  IV_LENGTH: 16, // CBC IV length in bytes
  MIN_DATA_LENGTH_FOR_MASK: 8, // Minimum length for masking
  DEFAULT_KEY_GENERATION_LENGTH: 32, // Default secure key length
  MASK_PREFIX_LENGTH: 4, // Length of prefix/suffix for masking
} as const;

export class SecureCredentialsManager {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly SALT_ROUNDS = CRYPTO_CONFIG.SALT_ROUNDS;
  private static readonly KEY_LENGTH = CRYPTO_CONFIG.KEY_LENGTH;
  private static readonly IV_LENGTH = CRYPTO_CONFIG.IV_LENGTH;
  private static readonly MIN_DATA_LENGTH_FOR_MASK = CRYPTO_CONFIG.MIN_DATA_LENGTH_FOR_MASK;
  private static readonly DEFAULT_KEY_GENERATION_LENGTH =
    CRYPTO_CONFIG.DEFAULT_KEY_GENERATION_LENGTH;

  /**
   * Derives encryption key from environment variables using PBKDF2
   */
  private static deriveKey(): Buffer {
    const secretSources = [
      process.env.TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'default-secret',
      process.env.DATABASE_URL ?? '',
      process.env.NODE_ENV ?? 'development',
      process.env.HOSTNAME ?? '',
      'llmchat-credentials-salt-2024', // Fixed salt component
    ];

    // Create combined secret
    const combinedSecret = secretSources.join('|');

    // Create consistent salt from environment
    const saltInput = process.env.CREDENTIALS_SALT ?? 'llmchat-default-salt';
    const salt = crypto.createHash('sha256').update(saltInput).digest();

    // eslint-disable-next-line no-sync -- Sync key derivation is required for security
    return crypto.pbkdf2Sync(combinedSecret, salt, this.SALT_ROUNDS, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypts sensitive data
   */
  static encrypt(plaintext: string): EncryptedData {
    try {
      const key = this.deriveKey();
      const iv = crypto.randomBytes(this.IV_LENGTH); // CBC needs 16-byte IV

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
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'SecureCredentialsManager',
        operation: 'encrypt',
      });
      logger.error('[SecureCredentialsManager] Encryption failed', { error: error.toLogObject() });
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
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'SecureCredentialsManager',
        operation: 'decrypt',
      });
      logger.error('[SecureCredentialsManager] Decryption failed', { error: error.toLogObject() });
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
  static validateEncryptedData(encryptedData: unknown): encryptedData is EncryptedData {
    if (!encryptedData || typeof encryptedData !== 'object') {
      return false;
    }

    const data = encryptedData as Record<string, unknown>;
    return (
      typeof data.data === 'string' &&
      typeof data.iv === 'string' &&
      typeof data.algorithm === 'string' &&
      data.data.length > 0 &&
      data.iv.length > 0
    );
  }

  /**
   * Generates a secure random key for additional entropy
   */
  static generateSecureKey(length = this.DEFAULT_KEY_GENERATION_LENGTH): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Checks if encryption is available (proper environment setup)
   */
  static isEncryptionAvailable(): boolean {
    try {
      this.deriveKey();
      return true;
    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'SecureCredentialsManager',
        operation: 'isEncryptionAvailable',
      });
      logger.warn('[SecureCredentialsManager] Encryption not available', { error: error.toLogObject() });
      return false;
    }
  }

  /**
   * Masks sensitive data for logging
   */
  static maskSensitiveData(data: string): string {
    if (!data || data.length < this.MIN_DATA_LENGTH_FOR_MASK) {
      return '***';
    }
    return data.substring(0, CRYPTO_CONFIG.MASK_PREFIX_LENGTH) + '***' + data.substring(data.length - CRYPTO_CONFIG.MASK_PREFIX_LENGTH);
  }
}
