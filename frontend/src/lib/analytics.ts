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

/**
 * 事件参数类型
 */
interface EventParams {
  [key: string]: string | number | boolean | undefined;
}

/**
 * 用户属性类型
 */
interface UserProperties {
  id?: string;
  role?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Analytics配置
 */
interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
}

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
      window.gtag('set', 'user_properties', properties);
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
    sessionStorage.setItem(`timing_${eventName}`, startTime.toString());
  }

  /**
   * 追踪时间事件（结束）
   */
  endTimedEvent(eventName: string, params?: EventParams) {
    if (!this.config.enabled) {
      return;
    }

    const startTimeStr = sessionStorage.getItem(`timing_${eventName}`);
    if (!startTimeStr) {
      return;
    }

    const startTime = parseFloat(startTimeStr);
    const duration = Math.round(performance.now() - startTime);

    sessionStorage.removeItem(`timing_${eventName}`);

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
      window.gtag('event', eventName, params);
    }

    // 自定义分析后端（可选）
    if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
      fetch(import.meta.env.VITE_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: eventName,
          params,
          timestamp: new Date().toISOString(),
          session_id: this._getSessionId(),
        }),
      }).catch((error) => {
        console.error('发送分析事件失败:', error);
      });
    }
  }

  /**
   * 获取会话ID
   */
  private _getSessionId(): string {
    let sessionId = sessionStorage.getItem('analytics_session_id');

    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }

    return sessionId;
  }
}

// 单例实例
export const analytics = new Analytics();

// 导出类型
export type { EventParams, UserProperties, AnalyticsConfig };
