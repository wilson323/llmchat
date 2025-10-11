import { toIsoRangeFromDate } from './toIsoRangeFromDate';

export function toIsoRangeFromInput(value: string, endOfDay: boolean): string {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = parseInt(yearStr || '', 10);
  const month = parseInt(monthStr || '', 10);
  const day = parseInt(dayStr || '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return toIsoRangeFromDate(new Date(), endOfDay);
  }
  const date = new Date();
  date.setFullYear(year, Math.max(0, month - 1), day);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

export default toIsoRangeFromInput;