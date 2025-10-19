/**
 * 用户行为分析
 *
 * 功能：
 * - 页面访问追踪
 * - 用户操作追踪
 * - 自定义事件追踪
 * - 用户属性管理
 */


import { addBreadcrumb } from './sentry';
import type { SafeEventParams, SafeUserProperties, SafeAnalyticsConfig } from '@/types/global';

// 使用安全类型别名
type EventParams = SafeEventParams;
type UserProperties = SafeUserProperties;
type AnalyticsConfig = SafeAnalyticsConfig;

class Analytics {
  private config: AnalyticsConfig = {
    enabled: false,
    debug: false,
  };

  /**
   * 初始化分析工具
   */
  init(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      ...this.config,
      ...config,
    };

    if (this.config.enabled) {
      console.log('用户行为分析已启用');
    }
  }

  /**
   * 追踪页面访问
   */
  trackPageView(path: string, title?: string) {
    if (!this.config.enabled) {
      return;
    }

    const params: EventParams = {
      page_path: path,
      page_title: title || document.title,
      referrer: document.referrer,
    };

    this._sendEvent('page_view', params);

    addBreadcrumb(
      `页面访问: ${path}`,
      'navigation',
      'info',
    );
  }

  /**
   * 追踪自定义事件
   */
  trackEvent(eventName: string, params?: EventParams) {
    if (!this.config.enabled) {
      return;
    }

    this._sendEvent(eventName, params);

    if (this.config.debug) {
      console.log('[Analytics] Event:', eventName, params);
    }
  }

  /**
   * 追踪智能体操作
   */
  trackAgentAction(action: 'create' | 'edit' | 'delete' | 'toggle' | 'fetch_info', agentId?: string) {
    this.trackEvent('agent_action', {
      action,
      agent_id: agentId,
      timestamp: Date.now(),
    });
  }

  /**
   * 追踪聊天操作
   */
  trackChatAction(action: 'send_message' | 'new_chat' | 'delete_chat', chatId?: string) {
    this.trackEvent('chat_action', {
      action,
      chat_id: chatId,
      timestamp: Date.now(),
    });
  }

  /**
   * 追踪表单交互
   */
  trackFormInteraction(formName: string, action: 'open' | 'submit' | 'cancel' | 'error', error?: string) {
    this.trackEvent('form_interaction', {
      form_name: formName,
      action,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * 追踪错误
   */
  trackError(error: Error, context?: string) {
    this.trackEvent('error', {
      error_message: error.message,
      error_stack: error.stack?.substring(0, 200), // 截断堆栈
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * 设置用户属性
   */
  setUserProperties(properties: UserProperties) {
    if (!this.config.enabled) {
      return;
    }

    if (window.gtag) {
      // 类型安全的gtag调用
      window.gtag('set', 'user_properties', properties as Record<string, any>);
    }

    if (this.config.debug) {
      console.log('[Analytics] User properties:', properties);
    }
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string) {
    if (!this.config.enabled) {
      return;
    }

    if (window.gtag) {
      // 类型安全的gtag调用
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        user_id: userId,
      });
    }

    if (this.config.debug) {
      console.log('[Analytics] User ID:', userId);
    }
  }

  /**
   * 追踪时间事件（开始）
   */
  startTimedEvent(eventName: string) {
    if (!this.config.enabled) {
      return;
    }

    const startTime = performance.now();
    try {
      sessionStorage.setItem(`timing_${eventName}`, startTime.toString());
    } catch (unknownError: unknown) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      console.warn('无法写入sessionStorage:', error.message);
    }
  }

  /**
   * 追踪时间事件（结束）
   */
  endTimedEvent(eventName: string, params?: EventParams) {
    if (!this.config.enabled) {
      return;
    }

    let startTimeStr: string | null = null;
    try {
      startTimeStr = sessionStorage.getItem(`timing_${eventName}`);
    } catch (unknownError: unknown) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      console.warn('无法读取sessionStorage:', error.message);
      return;
    }

    if (!startTimeStr) {
      return;
    }

    const startTime = parseFloat(startTimeStr);
    if (isNaN(startTime)) {
      console.warn('无效的开始时间:', startTimeStr);
      return;
    }

    const duration = Math.round(performance.now() - startTime);

    try {
      sessionStorage.removeItem(`timing_${eventName}`);
    } catch (unknownError: unknown) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      console.warn('无法删除sessionStorage项:', error.message);
    }

    this.trackEvent(eventName, {
      ...params,
      duration,
    });
  }

  /**
   * 内部方法：发送事件
   */
  private _sendEvent(eventName: string, params?: EventParams) {
    // Google Analytics
    if (window.gtag) {
      // 类型安全的gtag调用
      window.gtag('event', eventName, params as Record<string, any>);
    }

    // 自定义分析后端（可选）
    if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
      const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
      const payload = {
        event: eventName,
        params: params || {},
        timestamp: new Date().toISOString(),
        session_id: this._getSessionId(),
      };

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).catch((unknownError: unknown) => {
        const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
        console.error('发送分析事件失败:', error.message);
      });
    }
  }

  /**
   * 获取会话ID
   */
  private _getSessionId(): string {
    let sessionId: string | null = null;

    try {
      sessionId = sessionStorage.getItem('analytics_session_id');
    } catch (unknownError: unknown) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      console.warn('无法读取sessionStorage中的会话ID:', error.message);
    }

    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      try {
        sessionStorage.setItem('analytics_session_id', sessionId);
      } catch (unknownError: unknown) {
        const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
        console.warn('无法写入sessionStorage中的会话ID:', error.message);
      }
    }

    return sessionId;
  }
}

// 单例实例
export const analytics = new Analytics();

// 导出类型
export type { EventParams, UserProperties, AnalyticsConfig };