#!/usr/bin/env node

/**
 * 提取主要组件脚本
 * 从备份文件中提取主要组件到独立文件
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 提取主要组件...\n');

const backupPath = path.join(process.cwd(), 'src/components/admin/AdminHome.tsx.backup');
const adminDir = path.join(process.cwd(), 'src/components/admin');

if (!fs.existsSync(backupPath)) {
  console.error('❌ 备份文件不存在:', backupPath);
  process.exit(1);
}

try {
  const content = fs.readFileSync(backupPath, 'utf8');

  // 需要提取的主要组件
  const mainComponents = [
    'Sidebar',
    'TopHeader',
    'DashboardContent',
    'UsersManagement',
    'AnalyticsPanel',
    'DocumentsPanel',
    'SettingsPanel',
    'LogsPanel',
    'AgentsPanel',
    'SLADashboard',
    'ChangePasswordDialog'
  ];

  mainComponents.forEach(componentName => {
    const regex = new RegExp(`function ${componentName}\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=\\nfunction|\\nexport|$)`, 'g');
    const match = content.match(regex);

    if (match) {
      console.log(`📝 提取组件: ${componentName}`);

      // 构建组件文件内容
      const componentContent = `/**
 * ${componentName} 组件
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
  ShieldAlert, Search, Monitor, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

${match[0]}

export default ${componentName};
`;

      const componentPath = path.join(adminDir, `${componentName}.tsx`);
      fs.writeFileSync(componentPath, componentContent, 'utf8');
      console.log(`  ✅ 创建: ${componentPath}`);
    } else {
      console.log(`  ⚠️  未找到组件: ${componentName}`);
    }
  });

  console.log('\n🎉 主要组件提取完成！');

} catch (error) {
  console.error('❌ 提取失败:', error.message);
  process.exit(1);
}