import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import { getSystemInfo, getLogsPage, getUsers, exportLogsCsv, createUser, updateUser, resetUserPassword } from '@/services/adminApi';
// TODO: 添加其他必要的导入

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