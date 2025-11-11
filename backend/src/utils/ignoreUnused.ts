// TRACE-utils-20251111-忽略未使用参数辅助
/**
 * ignoreUnused 帮助函数用于显式标记暂未使用的变量，避免在启用
 * `noUnusedLocals` / `noUnusedParameters` 时产生编译错误。
 *
 * @param args 任意暂未使用的变量集合
 *
 * @example
 * ```ts
 * import { ignoreUnused } from '@/utils/ignoreUnused';
 *
 * export const handler = (req: Request, res: Response): void => {
 *   ignoreUnused(req, res);
 *   // TODO: 实现业务逻辑
 * };
 * ```
 */
export const ignoreUnused = (...args: Array<unknown>): void => {
  for (const arg of args) {
    void arg;
  }
};
