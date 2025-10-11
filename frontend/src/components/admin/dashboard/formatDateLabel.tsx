// 工具函数：格式化日期标签

function formatDateLabel(value: string): string {
  const [, monthStr, dayStr] = value.split('-');
  const month = parseInt(monthStr || '', 10);
  const day = parseInt(dayStr || '', 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return value;
  }
  return `${month}/${day}`;
}

export default formatDateLabel;