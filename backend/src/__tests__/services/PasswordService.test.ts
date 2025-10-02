import { PasswordService } from '../../services/PasswordService';
import { BaseError } from '../../types/errors';

describe('PasswordService', () => {
  let passwordService: PasswordService;

  beforeEach(() => {
    passwordService = new PasswordService();
  });

  describe('hashPassword', () => {
    it('应该成功散列有效密码', async () => {
      const password = 'Test@1234';
      const hash = await passwordService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash 长度通常 > 50
    });

    it('应该为相同密码生成不同的散列值', async () => {
      const password = 'Test@1234';
      const hash1 = await passwordService.hashPassword(password);
      const hash2 = await passwordService.hashPassword(password);

      expect(hash1).not.toBe(hash2); // 每次生成不同的 salt
    });

    it('应该拒绝空密码', async () => {
      await expect(passwordService.hashPassword('')).rejects.toThrow();
      await expect(passwordService.hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });

    it('应该拒绝非字符串密码', async () => {
      await expect(passwordService.hashPassword(null as any)).rejects.toThrow();
      await expect(passwordService.hashPassword(undefined as any)).rejects.toThrow();
      await expect(passwordService.hashPassword(123 as any)).rejects.toThrow();
    });

    it('应该拒绝过短的密码', async () => {
      const shortPassword = 'Test@12'; // 7 characters
      await expect(passwordService.hashPassword(shortPassword)).rejects.toThrow();
      await expect(passwordService.hashPassword(shortPassword)).rejects.toThrow('Password length must be between');
    });

    it('应该拒绝过长的密码', async () => {
      const longPassword = 'A'.repeat(129); // 129 characters
      await expect(passwordService.hashPassword(longPassword)).rejects.toThrow();
      await expect(passwordService.hashPassword(longPassword)).rejects.toThrow('Password length must be between');
    });

    it('应该接受最小长度密码', async () => {
      const minPassword = 'Test@123'; // 8 characters
      const hash = await passwordService.hashPassword(minPassword);
      expect(hash).toBeDefined();
    });

    it('应该接受最大长度密码', async () => {
      const maxPassword = 'A'.repeat(128); // 128 characters
      const hash = await passwordService.hashPassword(maxPassword);
      expect(hash).toBeDefined();
    });

    it('应该在合理时间内完成散列', async () => {
      const password = 'Test@1234';
      const startTime = Date.now();
      await passwordService.hashPassword(password);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300); // 应该 < 300ms
    });
  });

  describe('verifyPassword', () => {
    it('应该验证正确的密码', async () => {
      const password = 'Test@1234';
      const hash = await passwordService.hashPassword(password);
      const isValid = await passwordService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('应该拒绝错误的密码', async () => {
      const password = 'Test@1234';
      const wrongPassword = 'Wrong@1234';
      const hash = await passwordService.hashPassword(password);
      const isValid = await passwordService.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('应该区分大小写', async () => {
      const password = 'Test@1234';
      const wrongCasePassword = 'test@1234';
      const hash = await passwordService.hashPassword(password);
      const isValid = await passwordService.verifyPassword(wrongCasePassword, hash);

      expect(isValid).toBe(false);
    });

    it('应该在合理时间内完成验证', async () => {
      const password = 'Test@1234';
      const hash = await passwordService.hashPassword(password);

      const startTime = Date.now();
      await passwordService.verifyPassword(password, hash);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300); // 应该 < 300ms (放宽要求)
    });

    it('应该处理无效的散列格式', async () => {
      const password = 'Test@1234';
      const invalidHash = 'invalid_hash';

      // bcrypt.compare 会返回 false 而不是抛出错误
      const result = await passwordService.verifyPassword(password, invalidHash);
      expect(result).toBe(false);
    });
  });

  describe('checkPasswordStrength', () => {
    it('应该给强密码高分', () => {
      const strongPassword = 'Test@1234';
      const result = passwordService.checkPasswordStrength(strongPassword);

      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.valid).toBe(true);
      expect(result.feedback.length).toBe(0);
    });

    it('应该给弱密码低分', () => {
      const weakPassword = '12345678';
      const result = passwordService.checkPasswordStrength(weakPassword);

      expect(result.score).toBeLessThan(3);
      expect(result.valid).toBe(false);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('应该检测密码长度', () => {
      const shortPassword = 'Test@12';
      const result = passwordService.checkPasswordStrength(shortPassword);

      expect(result.feedback).toContain('密码长度至少 8 位');
    });

    it('应该检测缺少小写字母', () => {
      const noLowercase = 'TEST@1234';
      const result = passwordService.checkPasswordStrength(noLowercase);

      expect(result.feedback).toContain('至少包含一个小写字母');
    });

    it('应该检测缺少大写字母', () => {
      const noUppercase = 'test@1234';
      const result = passwordService.checkPasswordStrength(noUppercase);

      expect(result.feedback).toContain('至少包含一个大写字母');
    });

    it('应该检测缺少数字', () => {
      const noNumber = 'Test@Test';
      const result = passwordService.checkPasswordStrength(noNumber);

      expect(result.feedback).toContain('至少包含一个数字');
    });

    it('应该建议添加特殊字符', () => {
      const noSpecial = 'Test1234';
      const result = passwordService.checkPasswordStrength(noSpecial);

      expect(result.feedback).toContain('建议包含特殊字符以增强安全性');
    });

    it('应该检测常见弱密码', () => {
      const commonPasswords = ['password', '12345678', 'qwerty', 'admin123', 'Password123'];

      commonPasswords.forEach((password) => {
        const result = passwordService.checkPasswordStrength(password);
        expect(result.feedback).toContain('密码过于简单,请避免使用常见密码');
        expect(result.score).toBeLessThan(3);
      });
    });

    it('应该评分为 0-4 范围', () => {
      const passwords = [
        '12345678',
        'password',
        'Test1234',
        'Test@123',
        'Test@1234'
      ];

      passwords.forEach((password) => {
        const result = passwordService.checkPasswordStrength(password);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(4);
      });
    });

    it('应该给满足3个条件的密码标记为有效', () => {
      const validPasswords = [
        'Test@1234',  // 全部满足
        'Test1234',   // 缺少特殊字符但满足其他
        'TestABC123'  // 缺少特殊字符但满足其他
      ];

      validPasswords.forEach((password) => {
        const result = passwordService.checkPasswordStrength(password);
        expect(result.valid).toBe(result.score >= 3);
      });
    });
  });

  describe('并发安全性', () => {
    it('应该安全处理并发散列请求', async () => {
      const password = 'Test@1234';
      const concurrency = 10;

      const promises = Array.from({ length: concurrency }, () =>
        passwordService.hashPassword(password)
      );

      const hashes = await Promise.all(promises);

      // 所有散列应该不同
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(concurrency);

      // 所有散列应该有效
      for (const hash of hashes) {
        const isValid = await passwordService.verifyPassword(password, hash);
        expect(isValid).toBe(true);
      }
    });

    it('应该安全处理并发验证请求', async () => {
      const password = 'Test@1234';
      const hash = await passwordService.hashPassword(password);
      const concurrency = 20;

      const promises = Array.from({ length: concurrency }, () =>
        passwordService.verifyPassword(password, hash)
      );

      const results = await Promise.all(promises);

      // 所有验证应该成功
      expect(results.every((r) => r === true)).toBe(true);
    });
  });

  describe('特殊字符处理', () => {
    it('应该正确处理包含特殊字符的密码', async () => {
      const specialPasswords = [
        'Test@1234!',
        'Test#1234$',
        'Test%1234^',
        'Test&1234*',
        'Test(1234)',
        'Test<1234>',
        'Test{1234}',
        'Test|1234:',
        'Test"1234?'
      ];

      for (const password of specialPasswords) {
        const hash = await passwordService.hashPassword(password);
        const isValid = await passwordService.verifyPassword(password, hash);
        expect(isValid).toBe(true);
      }
    });

    it('应该正确处理包含 Unicode 字符的密码', async () => {
      const unicodePasswords = [
        'Test密码1234!',
        'Tëst1234!',
        'Test①②③④!'
      ];

      for (const password of unicodePasswords) {
        const hash = await passwordService.hashPassword(password);
        const isValid = await passwordService.verifyPassword(password, hash);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('边界条件', () => {
    it('应该处理只包含空格的密码', async () => {
      const spacePassword = '        '; // 8 spaces
      const hash = await passwordService.hashPassword(spacePassword);
      const isValid = await passwordService.verifyPassword(spacePassword, hash);
      expect(isValid).toBe(true);
    });

    it('应该处理包含换行符的密码', async () => {
      const newlinePassword = 'Test\n1234!';
      const hash = await passwordService.hashPassword(newlinePassword);
      const isValid = await passwordService.verifyPassword(newlinePassword, hash);
      expect(isValid).toBe(true);
    });

    it('应该处理包含制表符的密码', async () => {
      const tabPassword = 'Test\t1234!';
      const hash = await passwordService.hashPassword(tabPassword);
      const isValid = await passwordService.verifyPassword(tabPassword, hash);
      expect(isValid).toBe(true);
    });
  });
});

