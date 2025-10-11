/**
 * UsersManagement 组件
 */

'use client';
import React, { useState, useEffect, memo } from 'react';
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
import { VirtualizedUsersList } from './VirtualizedUsersList';

export default memo(function UsersManagement() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        setLoading(true); const d = await getUsers(); setUsers(d); setErr(null);
      } catch {
        setErr('加载用户失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">{t('用户管理')}</h3>
            <Button onClick={async ()=>{
              const username = window.prompt(t('请输入新用户名'));
              if (!username) {
return;
}
              const password = window.prompt(t('请输入初始密码（至少6位）')) ?? '';
              try {
                const u = await createUser({ username, password });
                setUsers((prev)=>[u, ...prev]);
              } catch (e:any) {
 toast({ type: 'error', title: e?.response?.data?.message || t('创建失败') });
}
            }}>{t('新增用户')}</Button>
          </div>
          {loading && <div className="text-sm text-muted-foreground">{t('加载中...')}</div>}
          {err && <div className="text-sm text-red-600">{t(err)}</div>}
          {!loading && !err && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">ID</th>
                    <th className="py-2">{t('用户名')}</th>
                    <th className="py-2">{t('角色')}</th>
                    <th className="py-2">{t('状态')}</th>
                    <th className="py-2">{t('创建时间')}</th>
                    <th className="py-2">{t('操作')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="py-2">{u.id}</td>
                      <td className="py-2">{u.username}</td>
                      <td className="py-2">{u.role ?? '-'}</td>
                      <td className="py-2">{u.status ?? '-'}</td>
                      <td className="py-2">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>

                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" onClick={async ()=>{
                            const next = u.status === 'active' ? 'disabled' : 'active';
                            const nu = await updateUser({ id: u.id, status: next });
                            setUsers(prev=> prev.map(x=> x.id === u.id ? nu : x));
                          }}>{u.status === 'active' ? t('禁用') : t('启用')}</Button>
                          <Button variant="ghost" onClick={async ()=>{
                            const ret = await resetUserPassword({ id: u.id });
                            window.alert(`${t('新密码')}: ${ret.newPassword}`);
                          }}>
                            {t('重置密码')}
                          </Button>
                        </div>
                      </td>
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
});
