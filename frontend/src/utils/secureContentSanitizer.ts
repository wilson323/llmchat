/**
 * 安全内容处理工具模块
 *
 * 提供HTML注入防护、XSS防护和安全内容渲染功能
 * 遵循OWASP安全标准和最佳实践
 */

import DOMPurify from 'dompurify';

// 安全事件接口
interface SecurityEvent {
  type: string;
  threats?: string[];
  content?: string;
  timestamp: string;
  messageId?: string;
  userAgent?: string;
  url?: string;
}

// 安全配置常量
export const SECURITY_CONFIG = {
  // 允许的HTML标签（白名单）
  ALLOWED_TAGS: [
    // 基本文本格式
    'p', 'br', 'strong', 'em', 'u', 'i', 'b', 's', 'del', 'ins',
    // 标题
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // 列表
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // 代码
    'pre', 'code', 'kbd', 'samp',
    // 引用
    'blockquote', 'cite',
    // 表格
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // 分割线
    'hr',
    // 链接（需要特殊处理）
    'a',
    // 图片（需要特殊处理）
    'img'
  ],

  // 允许的属性（白名单）
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'class', 'id', 'style',
    // 表格属性
    'colspan', 'rowspan',
    // 代码块语言标识
    'data-language'
  ],

  // 允许的CSS属性（白名单）
  ALLOWED_CSS: [
    'color', 'background-color', 'font-size', 'font-weight',
    'text-align', 'margin', 'padding', 'border', 'display'
  ]
};

// DOMPurify配置
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: SECURITY_CONFIG.ALLOWED_TAGS,
  ALLOWED_ATTR: SECURITY_CONFIG.ALLOWED_ATTR,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_URI: false, // 禁止data URI以防止数据泄露
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: null,
    attributeNameCheck: null,
    allowCustomizedBuiltInElements: false
  },
  FORBID_SCRIPT: true,
  FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'button'],
  FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit']
};

/**
 * 安全内容清理器类
 */
export class SecureContentSanitizer {
  private static instance: SecureContentSanitizer;
  private sanitizer: DOMPurify.DOMPurifyI;
  private securityEvents: SecurityEvent[] = [];
  private maxEventLogs = 100; // 最大事件日志数量

  private constructor() {
    this.sanitizer = DOMPurify;
    this.configureSanitizer();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SecureContentSanitizer {
    if (!SecureContentSanitizer.instance) {
      SecureContentSanitizer.instance = new SecureContentSanitizer();
    }
    return SecureContentSanitizer.instance;
  }

  /**
   * 配置DOMPurify
   */
  private configureSanitizer(): void {
    // 添加自定义配置钩子
    this.sanitizer.addHook('uponSanitizeAttribute', (node, data) => {
      // 安全处理链接
      if (data.attrName === 'href' && data.attrValue) {
        // 阻止javascript:链接
        if (data.attrValue.toLowerCase().startsWith('javascript:')) {
          data.keepAttr = false;
          return;
        }

        // 外部链接添加安全属性
        if (data.attrValue.startsWith('http') && !data.attrValue.includes(window.location.hostname)) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }

      // 安全处理样式
      if (data.attrName === 'style' && data.attrValue) {
        const cleanStyle = this.sanitizeCSS(data.attrValue);
        if (cleanStyle !== data.attrValue) {
          node.setAttribute('style', cleanStyle);
        }
      }
    });

    // 添加节点处理钩子
    this.sanitizer.addHook('uponSanitizeElement', (node, data) => {
      // 处理代码块
      if (data.elementName === 'code' && node.parentElement) {
        const preParent = node.parentElement.tagName.toLowerCase();
        if (preParent === 'pre') {
          // 为代码块添加语言标识处理
          const className = node.getAttribute('class') || '';
          if (className.includes('language-')) {
            node.setAttribute('data-language', className.replace('language-', ''));
          }
        }
      }
    });
  }

  /**
   * 清理CSS样式
   */
  private sanitizeCSS(css: string): string {
    // 移除不安全的CSS属性
    const unsafePatterns = [
      /expression\s*\(/gi,        // IE expression()
      /javascript\s*:/gi,         // JavaScript URL
      /behavior\s*:/gi,           // IE behavior
      /@import/gi,                // CSS import
      /binding\s*:/gi             // CSS binding
    ];

    let cleanCSS = css;
    unsafePatterns.forEach(pattern => {
      cleanCSS = cleanCSS.replace(pattern, '');
    });

    return cleanCSS.trim();
  }

  /**
   * 清理HTML内容
   */
  sanitizeHTML(dirty: string): string {
    if (typeof dirty !== 'string') {
      console.warn('SecureContentSanitizer: 非字符串输入，已转换');
      dirty = String(dirty || '');
    }

    return this.sanitizer.sanitize(dirty, DOMPURIFY_CONFIG);
  }

  /**
   * 清理并限制内容长度
   */
  sanitizeHTMLWithLength(dirty: string, maxLength: number = 10000): string {
    const clean = this.sanitizeHTML(dirty);
    return clean.length > maxLength ? clean.substring(0, maxLength) : clean;
  }

  /**
   * 转义纯文本内容（用于不使用HTML的场景）
   */
  escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 验证URL安全性
   */
  isSafeURL(url: string): boolean {
    try {
      const parsedUrl = new URL(url, window.location.origin);

      // 只允许特定协议
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        return false;
      }

      // 检查是否为相对路径或同域名
      if (parsedUrl.origin === window.location.origin || !url.includes('://')) {
        return true;
      }

      // 外部链接需要进一步验证
      return this.isDomainWhitelisted(parsedUrl.hostname);
    } catch {
      return false;
    }
  }

  /**
   * 检查域名是否在白名单中
   */
  private isDomainWhitelisted(hostname: string): boolean {
    const whitelist = [
      'github.com',
      'stackoverflow.com',
      'developer.mozilla.org',
      'npmjs.com',
      'typescriptlang.org'
    ];

    return whitelist.includes(hostname) || hostname.endsWith('.github.io');
  }

  /**
   * 检测潜在XSS攻击
   */
  detectXSS(content: string): { isXSS: boolean; threats: string[] } {
    const threats: string[] = [];
    const lowerContent = content.toLowerCase();

    // XSS攻击模式
    const xssPatterns = [
      { pattern: /<script[^>]*>/gi, threat: 'script标签注入' },
      { pattern: /javascript:/gi, threat: 'JavaScript协议注入' },
      { pattern: /on\w+\s*=/gi, threat: '事件处理器注入' },
      { pattern: /<iframe[^>]*>/gi, threat: 'iframe注入' },
      { pattern: /<object[^>]*>/gi, threat: 'object标签注入' },
      { pattern: /<embed[^>]*>/gi, threat: 'embed标签注入' },
      { pattern: /expression\s*\(/gi, threat: 'CSS表达式注入' },
      { pattern: /@import/gi, threat: 'CSS导入注入' },
      { pattern: /vbscript:/gi, threat: 'VBScript注入' },
      { pattern: /data:text\/html/gi, threat: 'Data URL HTML注入' }
    ];

    xssPatterns.forEach(({ pattern, threat }) => {
      if (pattern.test(lowerContent)) {
        threats.push(threat);
      }
    });

    return {
      isXSS: threats.length > 0,
      threats
    };
  }

  /**
   * 安全地渲染Markdown内容
   */
  sanitizeMarkdown(markdown: string): string {
    // 简单的Markdown到HTML转换（生产环境建议使用marked.js等专门库）
    let html = markdown
      // 标题
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        if (this.isSafeURL(url)) {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return text; // 不安全的链接只显示文本
      })
      // 换行
      .replace(/\n/g, '<br>');

    return this.sanitizeHTML(html);
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'userAgent' | 'url'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    // 添加到事件日志
    this.securityEvents.push(fullEvent);

    // 限制日志数量
    if (this.securityEvents.length > this.maxEventLogs) {
      this.securityEvents = this.securityEvents.slice(-this.maxEventLogs);
    }

    // 输出到控制台（生产环境可以考虑发送到安全监控服务）
    console.warn('安全事件记录:', fullEvent);

    // 发送到安全监控端点（如果配置了的话）
    this.sendToSecurityMonitor(fullEvent);
  }

  /**
   * 获取安全事件日志
   */
  getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents];
  }

  /**
   * 清空安全事件日志
   */
  clearSecurityEvents(): void {
    this.securityEvents = [];
  }

  /**
   * 发送安全事件到监控服务
   */
  private sendToSecurityMonitor(event: SecurityEvent): void {
    // 这里可以实现发送到安全监控服务的逻辑
    // 例如发送到后端API或第三方安全服务
    try {
      // 示例：发送到后端安全监控端点
      if (typeof window !== 'undefined' && window.fetch) {
        fetch('/api/security/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }).catch(() => {
          // 忽略网络错误，不阻塞用户体验
        });
      }
    } catch {
      // 忽略错误，安全监控不应该影响用户体验
    }
  }

  /**
   * 获取安全统计信息
   */
  getSecurityStats(): {
    totalEvents: number;
    xssAttempts: number;
    topThreats: Array<{ threat: string; count: number }>;
    recentActivity: SecurityEvent[];
  } {
    const xssEvents = this.securityEvents.filter(e => e.type === 'XSS_DETECTED');
    const threatCounts: Record<string, number> = {};

    // 统计威胁类型
    xssEvents.forEach(event => {
      if (event.threats) {
        event.threats.forEach(threat => {
          threatCounts[threat] = (threatCounts[threat] || 0) + 1;
        });
      }
    });

    // 转换为排序的威胁列表
    const topThreats = Object.entries(threatCounts)
      .map(([threat, count]) => ({ threat, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: this.securityEvents.length,
      xssAttempts: xssEvents.length,
      topThreats,
      recentActivity: this.securityEvents.slice(-10)
    };
  }
}

// 导出单例实例
export const secureContentSanitizer = SecureContentSanitizer.getInstance();

// 为了向后兼容，添加缺失的方法
secureContentSanitizer.logSecurityEvent = function(event: Omit<SecurityEvent, 'userAgent' | 'url'>): void {
  // 在类实现中已定义此方法
};

// 便捷函数
export const sanitizeHTML = (content: string): string =>
  secureContentSanitizer.sanitizeHTML(content);

export const escapeHTML = (content: string): string =>
  secureContentSanitizer.escapeHTML(content);

export const sanitizeMarkdown = (content: string): string =>
  secureContentSanitizer.sanitizeMarkdown(content);

export const detectXSS = (content: string) =>
  secureContentSanitizer.detectXSS(content);