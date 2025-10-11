import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import { getSystemInfo, getLogsPage, getUsers, exportLogsCsv, createUser, updateUser, resetUserPassword } from '@/services/adminApi';
// TODO: 添加其他必要的导入

function formatDateRangeReadable(start: string, end: string): string {
  const normalize = (input: string) => input.replace(/-/g, '/');
  return `${normalize(start)} ~ ${normalize(end)}`;
}

export default formatDateRangeReadable;