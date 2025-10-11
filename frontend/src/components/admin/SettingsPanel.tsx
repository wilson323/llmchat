/**
 * SettingsPanel 组件
 */

'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { logoutApi, changePasswordApi } from '@/services/authApi';
import {
  Menu, X, Home, Users, BarChart3, Settings, Sun, Moon, FileText,
  LogOut, User, Plus, RefreshCw, Upload, Edit, Trash2, ShieldCheck,
  ShieldAlert, Search, Monitor, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function SettingsPanel() {
  const { t } = useI18n();
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('系统设置')}</h3>
          <div className="text-sm text-muted-foreground">{t('此处为系统设置模块（模拟）。')}</div>
        </div>
      </div>
    </main>
  );
}


export default SettingsPanel;
