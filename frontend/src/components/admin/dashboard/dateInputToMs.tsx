import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import { getSystemInfo, getLogsPage, getUsers, exportLogsCsv, createUser, updateUser, resetUserPassword } from '@/services/adminApi';
// TODO: 添加其他必要的导入

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