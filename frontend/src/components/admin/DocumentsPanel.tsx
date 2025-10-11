/**
 * DocumentsPanel 组件
 */

'use client';
import { useI18n } from '@/i18n';

function DocumentsPanel() {
  const { t } = useI18n();
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('文档管理')}</h3>
          <div className="text-sm text-muted-foreground">{t('此处为文档管理模块（模拟）。')}</div>
        </div>
      </div>
    </main>
  );
}


export default DocumentsPanel;
