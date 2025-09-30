/**
 * 可访问性通知Hook - 简化屏幕阅读器通知的使用
 * 提供统一的方法来播报状态变化、错误信息和导航事件
 */
export const useA11yAnnouncer = () => {
  const announceMessage = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById(
      politeness === 'assertive' ? 'error-announcer' : 'navigation-announcer'
    );

    if (announcer) {
      announcer.textContent = message;

      // 清空消息，避免重复播报
      setTimeout(() => {
        announcer.textContent = '';
      }, 100);
    }
  };

  const announceStreamingStatus = (moduleName: string, status: string) => {
    const announcer = document.getElementById('streaming-status-announcer');
    if (announcer) {
      const statusText = status === 'running'
        ? `正在执行${moduleName}`
        : status === 'completed'
        ? `${moduleName}执行完成`
        : status === 'error'
        ? `${moduleName}执行出错`
        : `${moduleName}状态：${status}`;

      announcer.textContent = statusText;
    }
  };

  const announceNavigation = (action: string, target: string) => {
    announceMessage(`${action}${target}`);
  };

  const announceError = (error: string) => {
    announceMessage(`错误：${error}`, 'assertive');
  };

  const announceSuccess = (message: string) => {
    announceMessage(`成功：${message}`);
  };

  const announceNewMessage = (isUser: boolean) => {
    announceMessage(isUser ? '收到用户消息' : '收到AI回复');
  };

  const announceSessionChange = (sessionTitle: string) => {
    announceMessage(`切换到会话：${sessionTitle}`);
  };

  const announceAgentChange = (agentName: string) => {
    announceMessage(`切换到智能体：${agentName}`);
  };

  return {
    announceMessage,
    announceStreamingStatus,
    announceNavigation,
    announceError,
    announceSuccess,
    announceNewMessage,
    announceSessionChange,
    announceAgentChange
  };
};