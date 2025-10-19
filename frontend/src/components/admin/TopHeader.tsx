/**
 * 顶部头部组件
 */

'use client';

import { Menu } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n';

interface TopHeaderProps {
  onToggleSidebar: () => void;
  onToggleCollapse: () => void;
  sidebarCollapsed: boolean;
  username: string;
  onLogout: () => void;
  onChangePassword: () => void;
  title: string;
  breadcrumb: Array<{ label: string; to?: string }>;
}

export const TopHeader = memo(function TopHeader({
  onToggleSidebar,
  onToggleCollapse,
  sidebarCollapsed,
  username,
  onLogout,
  onChangePassword,
  title,
  breadcrumb,
}: TopHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden lg:block"
          >
            <Menu className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </Button>

          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {breadcrumb && breadcrumb.length > 1 && (
              <nav className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                {breadcrumb.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    {index > 0 && <span>/</span>}
                    {item.to ? (
                      <a href={item.to} className="hover:text-foreground transition-colors">
                        {item.label}
                      </a>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </div>
                ))}
              </nav>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-sm text-muted-foreground">
            {t('欢迎回来')}, {username}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onChangePassword}
            >
              {t('修改密码')}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={onLogout}
            >
              {t('退出')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
});