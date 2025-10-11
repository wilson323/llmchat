/**
 * 侧边栏组件
 */

'use client';
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, Home, Users, BarChart3, Settings, FileText, MessageSquare, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  username: string;
  activeItem: string;
  onChangeActive: (id: string) => void;
  onLogout: () => void;
  onChangePassword: () => void;
}

export const Sidebar = memo(function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse, username, activeItem, onChangeActive, onLogout, onChangePassword }: SidebarProps) {
  const { t } = useI18n();

  const navigationItems = [
    { id: 'dashboard', name: t('仪表板'), icon: Home },
    { id: 'users', name: t('用户管理'), icon: Users },
    { id: 'agents', name: t('智能体管理'), icon: Users },
    { id: 'sessions', name: t('会话管理'), icon: MessageSquare },
    { id: 'monitoring', name: t('SLA监控'), icon: Monitor },
    { id: 'analytics', name: t('数据分析'), icon: BarChart3 },
    { id: 'logs', name: t('日志管理'), icon: FileText },
    { id: 'settings', name: t('系统设置'), icon: Settings },
  ];

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed left-0 top-0 h-full bg-background/95 backdrop-blur-xl border-r border-border/50 shadow-2xl flex flex-col z-50 lg:relative lg:translate-x-0 ${collapsed ? 'w-20' : 'w-64'} transition-all duration-300 ${!isOpen && 'translate-x-0 lg:translate-x-0'}`}
      >
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <span className="text-sm font-bold text-white">V5</span>
              </div>
              <span className="font-semibold text-foreground">管理后台</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
              if (isDesktop) {
                onToggleCollapse();
              } else {
                onClose();
              }
            }}
            className="rounded-lg hover:bg-muted/50"
          >
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onChangeActive(item.id);
              if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches) {
                onClose();
              }
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
              activeItem === item.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-muted/50 text-foreground'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium truncate">{item.name}</span>
            )}
          </motion.button>
        ))}
      </nav>

      <div className="p-4 border-t border-border/50 mt-auto">
        <div className="flex flex-col gap-2">
          {!collapsed && (
            <div className="text-sm text-muted-foreground truncate">{username}</div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>{t('退出')}</span>}
          </Button>
        </div>
      </div>

      {/* 移动端遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
    </motion.div>
  );
});