/**
 * 日期处理工具函数
 * 整合所有日期相关的工具函数，避免重复
 */

/**
 * 格式化日期为输入框值 (YYYY-MM-DD)
 */
export const formatDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 将输入框日期转换为ISO范围
 */
export const toIsoRangeFromInput = (dateInput: string, isEnd: boolean): string => {
  const d = new Date(dateInput);
  if (isEnd) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
};

/**
 * 将Date对象转换为ISO范围
 */
export const toIsoRangeFromDate = (date: Date, isEnd: boolean): string => {
  const d = new Date(date);
  if (isEnd) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
};

/**
 * 格式化日期标签
 */
export const formatDateLabel = (date: Date): string => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * 格式化时间戳为可读格式
 */
export const formatTimestampReadable = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 格式化日期范围为可读格式
 */
export const formatDateRangeReadable = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startStr = formatDateLabel(start);
  const endStr = formatDateLabel(end);
  
  if (startStr === endStr) {
    return startStr;
  }
  
  return `${startStr} - ${endStr}`;
};

/**
 * 将毫秒转换为日期输入值
 */
export const dateInputToMs = (dateInput: string): number => {
  return new Date(dateInput).getTime();
};

/**
 * 获取默认的对话分析筛选条件
 */
export const getDefaultConversationFilters = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: formatDateInputValue(startOfMonth),
    endDate: formatDateInputValue(now),
    agentId: 'all',
  };
};