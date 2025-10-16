/**
 * Sentry Stub（存根实现）
 *
 * 用途:
 * - 当@sentry/react未安装时的降级实现
 * - 保持代码兼容性，不影响核心功能
 * - 开发环境可选依赖
 */

export const initSentry = async (): Promise<void> => {
  console.info('ℹ️  Sentry未配置，错误追踪功能禁用（开发模式）');
};

export const captureException = (error: Error | unknown): void => {
  console.error('❌ [Sentry Stub] 错误:', error);
};

export const captureMessage = (message: string, level?: string): void => {
  console.log(`📝 [Sentry Stub] ${level || 'info'}: ${message}`);
};

export const setUser = (user: { id?: string; email?: string; name?: string } | null): void => {
  console.debug('👤 [Sentry Stub] 用户:', user);
};

export const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return React.createElement(React.Fragment, null, children);
};