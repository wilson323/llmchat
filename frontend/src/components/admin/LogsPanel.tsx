/**
 * LogsPanel 组件
 */

'use client';
import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { getLogsPage, exportLogsCsv, type LogItem } from '@/services/adminApi';
import { Button } from '@/components/ui/Button';

function LogsPanel() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [level, setLevel] = useState<'' | 'INFO' | 'WARN' | 'ERROR'>('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchData = useCallback(async (p: number = page) => {
    try {
      setLoading(true);
      const params: { page: number; pageSize: number; level?: 'INFO' | 'WARN' | 'ERROR'; start?: string; end?: string } = { page: p, pageSize };
      if (level) {
        params.level = level;
      }
      if (start) {
        params.start = start;
      }
      if (end) {
        params.end = end;
      }
      const d = await getLogsPage(params);
      setLogs(d.items);
      setTotal(d.pagination.total);
      setErr(null);
    } catch (e) {
      setErr('加载日志失败');
    } finally {
      setLoading(false);
    }
  }, [level, start, end, page]);

  useEffect(() => {
    fetchData(1); setPage(1);
  }, [level, start, end, fetchData]);

  const onExport = async () => {
    try {
      const params: { level?: 'INFO' | 'WARN' | 'ERROR'; start?: string; end?: string } = {};
      if (level) {
        params.level = level;
      }
      if (start) {
        params.start = start;
      }
      if (end) {
        params.end = end;
      }
      const csv = await exportLogsCsv(params);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'logs.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <div className="flex items-end gap-3 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1" htmlFor="log-level-select">{t('级别')}</label>
              <select
                id="log-level-select"
                name="log-level-select"
                value={level}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setLevel(e.target.value as '' | 'INFO' | 'WARN' | 'ERROR')}
                className="h-9 px-2 rounded-md bg-muted/30 border border-border/30"
              >
                <option value="">{t('全部')}</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1" htmlFor="log-start-time">{t('开始时间')}</label>
              <input
                id="log-start-time"
                name="log-start-time"
                type="datetime-local"
                value={start}
                onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setStart(e.target.value)}
                className="h-9 px-2 rounded-md bg-muted/30 border border-border/30"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1" htmlFor="log-end-time">{t('结束时间')}</label>
              <input
                id="log-end-time"
                name="log-end-time"
                type="datetime-local"
                value={end}
                onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEnd(e.target.value)}
                className="h-9 px-2 rounded-md bg-muted/30 border border-border/30"
              />
            </div>
            <Button onClick={() => fetchData()}>{t('查询')}</Button>
            <Button variant="secondary" onClick={onExport}>{t('导出 CSV')}</Button>
          </div>

          <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
            <div>{t('共 {total} 条 | 第 {page} / {pages} 页', { total, page, pages: totalPages })}</div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={()=>{
 const p = Math.max(1, page - 1); setPage(p); fetchData(p);
}} disabled={page <= 1}>{t('上一页')}</Button>
              <Button variant="ghost" onClick={()=>{
 const max = Math.max(1, Math.ceil(total / pageSize)); const p = Math.min(max, page + 1); setPage(p); fetchData(p);
}} disabled={page >= Math.max(1, Math.ceil(total / pageSize))}>{t('下一页')}</Button>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-4">{t('日志管理')}</h3>
          {loading && <div className="text-sm text-muted-foreground">{t('加载中...')}</div>}
          {err && <div className="text-sm text-red-600">{t(err)}</div>}
          {!loading && !err && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">{t('时间')}</th>
                    <th className="py-2">{t('级别')}</th>
                    <th className="py-2">{t('内容')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {logs.map((l: LogItem) => (
                    <tr key={l.id}>
                      <td className="py-2">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${l.level === 'ERROR' ? 'bg-red-100 text-red-700' : l.level === 'WARN' ? 'bg-yellow-100 text-yellow-800' : 'bg-sky-100 text-sky-700'}`}>{l.level}</span></td>
                      <td className="py-2">{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


export default LogsPanel;