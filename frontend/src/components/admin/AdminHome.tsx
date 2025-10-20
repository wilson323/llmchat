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
import useAuthStore from '@/store/authStore';
import { logoutApi } from '@/services/authApi';
import { useI18n } from '@/i18n';

// 导入核心组件
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import DashboardContent from './DashboardContent';
import UsersManagement from './UsersManagement';
import { SessionManagement } from './SessionManagement';
import SettingsPanel from './SettingsPanel';
import LogsPanel from './LogsPanel';
import AgentsPanel from './AgentsPanel';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';

export default function AdminHome() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('dashboard');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const { t } = useI18n();
  const { user, logout, isAuthenticated } = useAuthStore.getState();
  const navigate = useNavigate();
  const location = useLocation();

  // 🔒 权限验证：检查用户是否已登录且具有管理员权限
  useEffect(() => {
    console.log('🔍 AdminHome权限检查:', { 
      isAuthenticated: isAuthenticated(), 
      user: user,
      userRole: user?.role 
    });

    if (!isAuthenticated()) {
      console.log('❌ 用户未登录，重定向到登录页面');
      navigate('/login', { replace: true });
      return;
    }

    if (!user) {
      console.log('❌ 用户信息为空，重定向到登录页面');
      navigate('/login', { replace: true });
      return;
    }

    if (user.role !== 'admin') {
      console.log('❌ 用户权限不足，重定向到登录页面', { 
        username: user.username, 
        role: user.role,
        expectedRole: 'admin' 
      });
      navigate('/login', { replace: true });
      return;
    }

    console.log('✅ 管理员权限验证通过', { 
      username: user.username, 
      role: user.role,
      userId: user.id 
    });
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const m = location.pathname.match(/^\/home\/?([^/]+)?/);
    const tab = m?.[1] ?? 'dashboard';
    const allowed = new Set(['dashboard', 'users', 'settings', 'logs', 'agents', 'monitoring', 'sessions']);
    setActiveItem(allowed.has(tab) ? tab : 'dashboard');
  }, [location.pathname]);

  const onLogout = async () => {
    await logoutApi();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* 移动端遮罩层 */}
      {isSidebarOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <div className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}>
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          username={user?.username ?? ''}
          activeItem={activeItem}
          onChangeActive={(id: string) => navigate(`/home/${id}`)}
          onLogout={onLogout}
          onChangePassword={() => setShowChangePwd(true)}
        />
      </div>

      {/* 主内容区域 */}
      <div className={`admin-main-content ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
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
        <main className="admin-content-wrapper">
          {activeItem === 'dashboard' && <DashboardContent sidebarCollapsed={sidebarCollapsed} />}
          {activeItem === 'users' && <UsersManagement />}
          {activeItem === 'sessions' && <SessionManagement />}
          {activeItem === 'settings' && <SettingsPanel />}
          {activeItem === 'logs' && <LogsPanel />}
          {activeItem === 'agents' && <AgentsPanel />}
          {activeItem === 'monitoring' && (
            <div className="p-8 text-center text-muted-foreground">
              <p>高级监控功能已禁用（减少资源占用）</p>
              <p className="text-sm mt-2">基础健康检查和错误日志仍然可用</p>
            </div>
          )}
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
