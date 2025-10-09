/**
 * 智能体伦理防火墙服务
 * 责任：在关键路径上对指令、上下文进行伦理合规评估，必要时拒绝执行或触发降级。
 *
 * 设计原则：
 * - 零冗余：复用现有保护体系（ProtectionService、监控、错误处理）
 * - 类型安全：显式类型定义与返回契约
 * - 最小侵入：以服务+轻量接入中间件的方式挂载
 *
 * 模块接口：
 * - evaluateCommand(context, payload): 返回伦理评估结果
 * - assertOrThrow(result): 不合规即抛出明确异常
 *
 * 依赖：无外部依赖，仅使用内置类型与受保护上下文
 *
 * 版本：v1.0.0
 */

// TRACE-ethics-20251005-拒绝执行指令时自毁

import { ProtectedRequestContext } from './ProtectionService';

export type EthicsVerdictCode =
  | 'OK'
  | 'RISK_HIGH'
  | 'RESOURCE_ABUSE'
  | 'DATA_LEAKAGE'
  | 'SELF_HARM'
  | 'UNKNOWN_AGENT'
  | 'POLICY_VIOLATION';

export interface EthicsCheckPayload {
  /**
   * 指令类型或动作名称
   */
  action: string;
  /**
   * 指令的自然语言或结构化内容
   */
  content?: unknown;
  /**
   * 敏感资源标志（如是否触发跨域、外部网络写入、数据导出）
   */
  sensitive?: boolean;
  /**
   * 需执行的资源标识（例如 modelId、storageTarget）
   */
  resourceId?: string;
}

export interface EthicsVerdict {
  ok: boolean;
  code: EthicsVerdictCode;
  reason?: string;
  /**
   * 建议的替代动作（降级策略）
   */
  fallbackAction?: string;
}

/**
 * EthicsFirewallService
 * 伦理防火墙核心服务，提供评估与断言能力
 *
 * Args:
 *  无
 * Returns:
 *  服务实例
 * Raises:
 *  无
 * Example:
 *  const firewall = new EthicsFirewallService();
 *  const verdict = firewall.evaluateCommand(ctx, { action: 'chat.send', sensitive: false });
 *  firewall.assertOrThrow(verdict);
 */
export class EthicsFirewallService {
  /**
   * evaluateCommand
   * 根据上下文与载荷进行伦理评估
   *
   * Args:
   *  context: ProtectedRequestContext - 受保护的请求上下文
   *  payload: EthicsCheckPayload - 伦理检查载荷
   * Returns:
   *  EthicsVerdict - 评估结论
   * Raises:
   *  无（仅返回结论；使用 assertOrThrow 执行强制断言）
   * Example:
   *  evaluateCommand(context, { action: 'agent.run', sensitive: true })
   */
  public evaluateCommand(
    context: ProtectedRequestContext,
    payload: EthicsCheckPayload
  ): EthicsVerdict {
    // 基本校验
    if (!context.agentId || context.agentId === 'unknown') {
      return {
        ok: false,
        code: 'UNKNOWN_AGENT',
        reason: '缺少有效的agentId',
        fallbackAction: '拒绝执行',
      };
    }

    // 高风险敏感动作拦截（示例策略：敏感资源需后续二次确认）
    if (payload.sensitive) {
      return {
        ok: false,
        code: 'RISK_HIGH',
        reason: '敏感操作需二次确认或审批',
        fallbackAction: '触发审批流程/只读模式',
      };
    }

    // 自伤/破坏性语言模式的简单检测（可扩展为规则引擎）
    const contentStr =
      typeof payload.content === 'string' ? payload.content : JSON.stringify(payload.content ?? '');
    const lower = contentStr.toLowerCase();
    if (
      lower.includes('自毁') ||
      lower.includes('删除所有') ||
      lower.includes('破坏系统') ||
      lower.includes('泄露机密')
    ) {
      return {
        ok: false,
        code: 'SELF_HARM',
        reason: '检测到可能的自伤/破坏性指令',
        fallbackAction: '改为只读、记录审计、通知管理员',
      };
    }

    // 资源滥用的简单检测：超长内容+未知目标
    if (!payload.resourceId && contentStr.length > 20000) {
      return {
        ok: false,
        code: 'RESOURCE_ABUSE',
        reason: '未指定目标资源且负载异常偏大',
        fallbackAction: '拆分任务或限制负载',
      };
    }

    // 默认通过
    return { ok: true, code: 'OK' };
  }

  /**
   * assertOrThrow
   * 对伦理评估结论进行断言，不通过则抛出详细异常
   *
   * Args:
   *  verdict: EthicsVerdict - 评估结论
   * Returns:
   *  void
   * Raises:
   *  Error - 不合规时抛出包含代码与原因的错误
   * Example:
   *  firewall.assertOrThrow(verdict);
   */
  public assertOrThrow(verdict: EthicsVerdict): void {
    if (!verdict.ok) {
      const message = `[ETHICS_BLOCKED:${verdict.code}] ${verdict.reason ?? '伦理规则不通过'}`
        + (verdict.fallbackAction ? ` | 建议: ${verdict.fallbackAction}` : '');
      const err = new Error(message);
      // 标记用于上层降级处理
      (err as unknown as { fallbackUsed?: boolean; data?: unknown }).fallbackUsed = false;
      throw err;
    }
  }
}

// TRACE-ethics-20251005-拒绝执行指令时自毁

/**
 * createDefaultFirewall
 * 创建默认伦理防火墙实例
 *
 * Args:
 *  无
 * Returns:
 *  EthicsFirewallService
 * Raises:
 *  无
 * Example:
 *  const firewall = createDefaultFirewall();
 */
export function createDefaultFirewall(): EthicsFirewallService {
  return new EthicsFirewallService();
}

// TRACE-ethics-20251005-拒绝执行指令时自毁