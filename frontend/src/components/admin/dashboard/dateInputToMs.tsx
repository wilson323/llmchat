// 工具函数：将日期输入转换为毫秒时间戳

function dateInputToMs(value: string): number {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = parseInt(yearStr || '', 10);
  const month = parseInt(monthStr || '', 10);
  const day = parseInt(dayStr || '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return 0;
  }
  const date = new Date();
  date.setFullYear(year, Math.max(0, month - 1), day);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export default dateInputToMs;