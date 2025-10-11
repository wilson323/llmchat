export function toIsoRangeFromDate(date: Date, endOfDay: boolean): string {
  const next = new Date(date);
  if (endOfDay) {
    next.setHours(23, 59, 59, 999);
  } else {
    next.setHours(0, 0, 0, 0);
  }
  return next.toISOString();
}

export default toIsoRangeFromDate;