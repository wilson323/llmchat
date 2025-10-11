#!/usr/bin/env node

/**
 * AdminHome.tsx 重构脚本
 *
 * 自动化拆分大组件为独立文件
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始重构 AdminHome.tsx...\n');

const adminHomePath = path.join(process.cwd(), 'src/components/admin/AdminHome.tsx');
const dashboardDir = path.join(process.cwd(), 'src/components/admin/dashboard');

// 确保目录存在
if (!fs.existsSync(dashboardDir)) {
  fs.mkdirSync(dashboardDir, { recursive: true });
}

try {
  const content = fs.readFileSync(adminHomePath, 'utf8');

  // 分析组件结构
  const componentMatches = content.match(/function (\w+)\([^)]*\):[^{]*\{[\s\S]*?(?=\nfunction|\nexport|\/\/ Type|$)/g);

  if (componentMatches) {
    console.log(`📊 发现 ${componentMatches.length} 个组件函数`);

    componentMatches.forEach((match, index) => {
      const componentName = match.match(/function (\w+)/)?.[1];
      if (componentName) {
        console.log(`📝 处理组件: ${componentName}`);

        // 提取组件代码
        const componentStart = content.indexOf(`function ${componentName}`);
        let componentEnd = content.indexOf('\nfunction', componentStart + 1);
        if (componentEnd === -1) {
          componentEnd = content.indexOf('\nexport', componentStart + 1);
        }
        if (componentEnd === -1) {
          componentEnd = content.length;
        }

        const componentCode = content.substring(componentStart, componentEnd).trim();

        // 创建独立组件文件
        const componentFile = path.join(dashboardDir, `${componentName}.tsx`);

        // 添加必要的导入
        const imports = [
          "import React, { useState, useEffect, useMemo, useCallback } from 'react';",
          "import { useI18n } from '@/i18n';",
          "import { toast } from '@/components/ui/Toast';",
          "import { getSystemInfo, getLogsPage, getUsers, exportLogsCsv, createUser, updateUser, resetUserPassword } from '@/services/adminApi';",
          "// TODO: 添加其他必要的导入"
        ].join('\n');

        const componentContent = `${imports}\n\n${componentCode}\n\nexport default ${componentName};`;

        fs.writeFileSync(componentFile, componentContent, 'utf8');
        console.log(`  ✅ 创建: ${componentFile}`);
      }
    });
  }

  // 创建重构后的主文件
  const refactoredMainContent = `/**
 * AdminHome - 重构后的主组件
 *
 * 主要功能：
 * - 作为各个管理面板的容器
 * - 处理路由和状态管理
 * - 提供统一的布局结构
 */

'use client';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { logoutApi, changePasswordApi } from '@/services/authApi';

// 导入拆分后的组件
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { DashboardContent } from './dashboard/DashboardContent';
import { UsersManagement } from './UsersManagement';
import { SessionManagement } from './SessionManagement';
import { AnalyticsPanel } from './AnalyticsPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { SettingsPanel } from './SettingsPanel';
import { LogsPanel } from './LogsPanel';
import { AgentsPanel } from './AgentsPanel';
import { SLADashboard } from './SLADashboard';
import { ChangePasswordDialog } from './ChangePasswordDialog';

export default function AdminHome() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('dashboard');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const m = location.pathname.match(/^\\/home\\/?([^\\/]+)?/);
    const tab = m?.[1] ?? 'dashboard';
    const allowed = new Set(['dashboard', 'users', 'analytics', 'documents', 'settings', 'logs', 'agents', 'monitoring', 'sessions']);
    setActiveItem(allowed.has(tab) ? tab : 'dashboard');
  }, [location.pathname]);

  const onLogout = async () => {
    await logoutApi();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        username={user?.username ?? ''}
        activeItem={activeItem}
        onChangeActive={(id) => navigate(\`/home/\${id}\`)}
        onLogout={onLogout}
        onChangePassword={() => setShowChangePwd(true)}
      />

      <div className="flex flex-col min-h-screen">
        <TopHeader
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
          username={user?.username ?? ''}
          onLogout={onLogout}
          onChangePassword={() => setShowChangePwd(true)}
          title={t('管理后台')}
          breadcrumb={[{ label: t('首页'), to: '/home/dashboard' }]}
        />

        {/* 主要内容区域 */}
        <main className="flex-1 p-6">
          {activeItem === 'dashboard' && <DashboardContent sidebarCollapsed={sidebarCollapsed} />}
          {activeItem === 'users' && <UsersManagement />}
          {activeItem === 'sessions' && <SessionManagement />}
          {activeItem === 'analytics' && <AnalyticsPanel />}
          {activeItem === 'documents' && <DocumentsPanel />}
          {activeItem === 'settings' && <SettingsPanel />}
          {activeItem === 'logs' && <LogsPanel />}
          {activeItem === 'agents' && <AgentsPanel />}
          {activeItem === 'monitoring' && <SLADashboard />}
        </main>
      </div>

      {showChangePwd && (
        <ChangePasswordDialog
          onClose={() => setShowChangePwd(false)}
          onSuccess={() => {
            setShowChangePwd(false);
            void onLogout();
          }}
        />
      )}
    </div>
  );
}
`;

  // 备份原文件
  const backupPath = adminHomePath + '.backup';
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`\n💾 原文件已备份: ${backupPath}`);

  // 写入重构后的主文件
  fs.writeFileSync(adminHomePath, refactoredMainContent, 'utf8');
  console.log(`✅ 重构后的主文件已创建: ${adminHomePath}`);

  console.log('\n🎉 AdminHome.tsx 重构完成！');
  console.log('\n📋 下一步操作:');
  console.log('1. 修复各个拆分组件中的导入问题');
  console.log('2. 创建缺失的组件文件 (Sidebar, TopHeader 等)');
  console.log('3. 测试重构后的功能');
  console.log('4. 清理未使用的代码');

} catch (error) {
  console.error('❌ 重构失败:', error.message);
  process.exit(1);
}