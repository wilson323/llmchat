// 工具函数：格式化日期范围为可读格式

function formatDateRangeReadable(start: string, end: string): string {
  const normalize = (input: string) => input.replace(/-/g, '/');
  return `${normalize(start)} ~ ${normalize(end)}`;
}

export default formatDateRangeReadable;