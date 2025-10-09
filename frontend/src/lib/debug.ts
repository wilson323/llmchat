const isDev =
  typeof import.meta !== "undefined" &&
  Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

export const debugLog = (...args: unknown[]): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    // ^ 在调试日志中使用console是必要的，仅在开发环境启用
    console.log(...args);
  }
};

export default debugLog;
