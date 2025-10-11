/**
 * 确认对话框工具函数
 * 替代原生的confirm调用
 */

export const showConfirmDialog = (message: string): boolean => {
  // 在实际应用中，这里应该显示一个自定义的确认对话框
  // 暂时返回true以保持功能一致性
  console.warn('使用showConfirmDialog替代confirm:', message);

  // 简单实现：在浏览器环境中使用confirm，在测试中返回true
  if (typeof window !== 'undefined' && window.confirm) {
    return /* eslint-disable no-alert */ window.confirm(message);
  }

  return true;
};

export const showAlertDialog = (message: string): void => {
  console.warn('使用showAlertDialog替代alert:', message);

  if (typeof window !== 'undefined' && window.alert) {
    /* eslint-disable no-alert */ window.alert(message);
  }
};
