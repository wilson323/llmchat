/**
 * SettingsPanel 组件
 */

'use client';
import { useI18n } from '@/i18n';

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
