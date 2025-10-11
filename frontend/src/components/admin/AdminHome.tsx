/**
 * AdminHome - 重构后的主组件
 *
 * 主要功能：
 * - 作为各个管理面板的容器
 * - 处理路由和状态管理
 * - 提供统一的布局结构
 */

'use client';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { logoutApi } from '@/services/authApi';
import { useI18n } from '@/i18n';

// 导入拆分后的组件
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import DashboardContent from './DashboardContent';
import UsersManagement from './UsersManagement';
import { SessionManagement } from './SessionManagement';
import AnalyticsPanel from './AnalyticsPanel';
import DocumentsPanel from './DocumentsPanel';
import SettingsPanel from './SettingsPanel';
import LogsPanel from './LogsPanel';
import AgentsPanel from './AgentsPanel';
import { SLADashboard } from '../monitoring/SLADashboard';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';

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
    const m = location.pathname.match(/^\/home\/?([^/]+)?/);
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
        onChangeActive={(id) => navigate(`/home/${id}`)}
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
