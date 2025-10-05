"use client";
import { useState, useEffect, useMemo, useCallback, FormEvent } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Home,
  Users,
  BarChart3,
  Settings,
  Sun,
  Moon,
  FileText,
  LogOut,
  User,
  Plus,
  RefreshCw,
  Upload,
  Edit,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Search,
  Monitor,
  MessageSquare,
} from "lucide-react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

import { useAuthStore } from "@/store/authStore";
import { logoutApi, changePasswordApi } from "@/services/authApi";
import { getSystemInfo, getLogsPage, getUsers, exportLogsCsv, createUser, updateUser, resetUserPassword, type SystemInfo, type LogItem, type AdminUser } from "@/services/adminApi";
import {
  listAgents,
  reloadAgents,
  updateAgent as updateAgentApi,
  validateAgent,
  createAgent,
  deleteAgent,
  importAgents,
  type AgentItem,
  type AgentPayload,
} from "@/services/agentsApi";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n";
import { useAgentAutoFetch } from "@/hooks/useAgentAutoFetch";
import {
  validateEndpoint,
  validateApiKey,
  validateAppId,
  validateModel,
  validateTemperature,
  validateMaxTokens,
} from "@/utils/agentValidation";
import { HelpIcon } from "@/components/ui/Tooltip";
import { getFieldTooltip } from "@/utils/agentFieldHelp";
import {
  getProvinceHeatmap,
  getConversationSeries,
  getAgentComparison,
  type ProvinceHeatmapDataset,
  type ConversationSeriesDataset,
  type AgentComparisonDataset,
} from "@/services/analyticsApi";
import { SLADashboard } from "@/components/monitoring";
import { SessionManagement } from "./SessionManagement";

// 动态加载中国地图 GeoJSON 数据（带降级策略）
let hasRegisteredChinaMap = false;
let mapLoadFailed = false;

const ensureChinaMap = async () => {
  if (hasRegisteredChinaMap || mapLoadFailed || typeof window === 'undefined') return;

  try {
    const mapUrl = new URL('maps/china.json', window.location.origin).toString();
    const response = await fetch(mapUrl, { 
      cache: 'force-cache',
      signal: AbortSignal.timeout(5000) // 5秒超时
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: 地图资源加载失败`);
    }

    const chinaMap = await response.json();
    
    // 验证地图数据完整性
    if (!chinaMap || !chinaMap.features || !Array.isArray(chinaMap.features)) {
      throw new Error('地图数据格式无效');
    }

    echarts.registerMap('china', chinaMap);
    hasRegisteredChinaMap = true;
    console.log('[AdminHome] ✅ 中国地图加载成功');
  } catch (error) {
    mapLoadFailed = true;
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    console.warn(`[AdminHome] ⚠️ 地图加载失败: ${errorMsg}，将使用降级方案（柱状图）`);
    
    // 提示用户（可选，避免过度打扰）
    if (process.env.NODE_ENV === 'development') {
      console.info('[AdminHome] 💡 降级方案已启用：地理分布将显示为柱状图');
    }
  }
};

void ensureChinaMap();

export default function AdminHome() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState<'dashboard'|'users'|'analytics'|'documents'|'settings'|'logs'|'agents'|'monitoring'|'sessions'>('dashboard');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const m = location.pathname.match(/^\/home\/?([^\/]+)?/);
    const tab = (m && m[1]) || 'dashboard';
    const allowed = new Set(['dashboard','users','analytics','documents','settings','logs','agents','monitoring','sessions']);
    setActiveItem(allowed.has(tab) ? (tab as any) : 'dashboard');
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
        username={user?.username || "\u0000"}
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
          username={user?.username || "\u0000"}
          onLogout={onLogout}
          onChangePassword={() => setShowChangePwd(true)}
          title={{
            dashboard: t('仪表板'),
            users: t('用户管理'),
            analytics: t('数据分析'),
            documents: t('文档管理'),
            settings: t('系统设置'),
            logs: t('日志管理'),
            agents: t('智能体管理'),
            monitoring: t('SLA监控'),
            sessions: t('会话管理'),
          }[activeItem] || t('仪表板')}
          breadcrumb={[
            { label: t('首页'), to: '/home/dashboard' },
            { label: {
              dashboard: t('仪表板'),
              users: t('用户管理'),
              analytics: t('数据分析'),
              documents: t('文档管理'),
              settings: t('系统设置'),
              logs: t('日志管理'),
              agents: t('智能体管理'),
              monitoring: t('SLA监控'),
              sessions: t('会话管理'),
            }[activeItem] || t('仪表板') }
          ]}
        />
        {activeItem === 'dashboard' && <DashboardContent sidebarCollapsed={sidebarCollapsed} />}
        {activeItem === 'users' && <UsersManagement />}
        {activeItem === 'sessions' && <SessionManagement />}
        {activeItem === 'analytics' && <AnalyticsPanel />}
        {activeItem === 'documents' && <DocumentsPanel />}
        {activeItem === 'settings' && <SettingsPanel />}
        {activeItem === 'logs' && <LogsPanel />}
        {activeItem === 'agents' && <AgentsPanel />}
        {activeItem === 'monitoring' && <SLADashboard />}
      </div>
      {showChangePwd && <ChangePasswordDialog onClose={() => setShowChangePwd(false)} onSuccess={() => { setShowChangePwd(false); onLogout(); }} />}
    </div>
  );
}

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse, username, activeItem, onChangeActive, onLogout, onChangePassword }: { isOpen: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void; username: string; activeItem: 'dashboard'|'users'|'analytics'|'documents'|'settings'|'logs'|'agents'|'monitoring'|'sessions'; onChangeActive: (id: 'dashboard'|'users'|'analytics'|'documents'|'settings'|'logs'|'agents'|'monitoring'|'sessions') => void; onLogout: () => void; onChangePassword: () => void; }) {
  const { t } = useI18n();

  const navigationItems = [
    { id: "dashboard", name: t("仪表板"), icon: Home, badge: null },
    { id: "users", name: t("用户管理"), icon: Users, badge: null },
    { id: "agents", name: t("智能体管理"), icon: Users, badge: null },
    { id: "sessions", name: t("会话管理"), icon: MessageSquare, badge: null },
    { id: "monitoring", name: t("SLA监控"), icon: Monitor, badge: null },
    { id: "analytics", name: t("数据分析"), icon: BarChart3, badge: null },
    { id: "logs", name: t("日志管理"), icon: FileText, badge: null },
    { id: "documents", name: t("文档管理"), icon: FileText, badge: null },
    { id: "settings", name: t("系统设置"), icon: Settings, badge: null },
  ];

  const sidebarContent = (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`h-full bg-background/95 backdrop-blur-xl border-r border-border/50 shadow-2xl flex flex-col ${collapsed ? "w-20" : "w-64"} transition-all duration-300`}
    >
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--brand)] to-[var(--brand)]/80 flex items-center justify-center">
                <span className="text-sm font-bold text-white">V5</span>
              </div>
              <span className="font-semibold text-foreground">Variant 5</span>
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches; // lg 断点
              if (isDesktop) {
                onToggleCollapse(); // 桌面：折叠/展开侧边栏
              } else {
                onClose(); // 移动：关闭抽屉
              }
            }}
            className="rounded-lg hover:bg-muted/50"
          >
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </Button>
        </div>

      </div>

      <div className="flex-1 p-4 space-y-2">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <motion.button key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} onClick={() => { onChangeActive(item.id as any); const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches; if (!isDesktop) onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? "bg-gradient-to-r from-[var(--brand)]/20 to-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
              <Icon className={`w-5 h-5 ${isActive ? "text-[var(--brand)]" : ""}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                  {item.badge && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--brand)]/20 text-[var(--brand)]">{item.badge}</span>}
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand)]/80 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{username || t('管理员')}</div>
              <div className="text-xs text-muted-foreground">{t('管理员')}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <>
            <Button className="mt-3 items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 disabled:pointer-events-none bg-muted text-foreground hover:bg-accent/30 border border-border/50 shadow-sm h-10 px-4 hidden md:inline-flex rounded-lg" onClick={onChangePassword}>{t('修改密码')}</Button>
            <Button variant="ghost" className="w-full mt-2 justify-start gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={onLogout}>
              <LogOut className="w-4 h-4" /> {t('退出登录')}
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <div className="hidden lg:block fixed left-0 top-0 h-full z-40">{sidebarContent}</div>
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="absolute left-0 top-0 h-full w-64">{sidebarContent}</div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function TopHeader({ onToggleSidebar, onToggleCollapse: _onToggleCollapse, sidebarCollapsed, username: _username, onLogout: _onLogout, onChangePassword: _onChangePassword, title, breadcrumb }: { onToggleSidebar: () => void; onToggleCollapse: () => void; sidebarCollapsed: boolean; username: string; onLogout: () => void; onChangePassword: () => void; title: string; breadcrumb: Array<{ label: string; to?: string }>; }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <motion.header data-testid="admin-header" className={`admin-header sticky top-0 z-30 h-16 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden rounded-lg">
            <Menu className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-2">
              {breadcrumb.map((b, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i>0 && <span className="opacity-50">/</span>}
                  <span>{b.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-lg" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </motion.header>
  );
}

function DashboardContent({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const { t } = useI18n();
  const analytics = useDashboardConversationAnalytics();
  return (
    <main className={`transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          <div className="lg:col-span-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <ConversationsTrendCard analytics={analytics} />
            </motion.div>
          </div>

          <div className="lg:col-span-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }} className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <AgentComparisonCard analytics={analytics} />
            </motion.div>
          </div>

          <div className="lg:col-span-4">
            <DashboardHeatmapCard />
          </div>

          <div className="lg:col-span-2">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.18 }} className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <ConversationSummaryCard analytics={analytics} />
            </motion.div>
          </div>

          <div className="lg:col-span-2">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }} className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">{t('服务器参数')}</h3>
              <ServerParamsCard />
            </motion.div>
          </div>

        </div>

      </div>
    </main>
  );
}


type ConversationAnalyticsFilters = {
  startDate: string;
  endDate: string;
  agentId: string;
};

type DashboardConversationAnalytics = {
  filters: ConversationAnalyticsFilters;
  setDateFilter: (key: 'startDate' | 'endDate', value: string) => void;
  setAgentId: (agentId: string) => void;
  refresh: () => Promise<void>;
  series: ConversationSeriesDataset | null;
  seriesLoading: boolean;
  seriesError: string | null;
  comparison: AgentComparisonDataset | null;
  comparisonLoading: boolean;
  comparisonError: string | null;
  agents: AgentItem[];
  agentsLoading: boolean;
};

function getDefaultConversationFilters(): ConversationAnalyticsFilters {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: formatDateInputValue(startOfMonth),
    endDate: formatDateInputValue(now),
    agentId: 'all',
  };
}

function useDashboardConversationAnalytics(): DashboardConversationAnalytics {
  const { t } = useI18n();
  const [filters, setFilters] = useState<ConversationAnalyticsFilters>(getDefaultConversationFilters);
  const [series, setSeries] = useState<ConversationSeriesDataset | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<AgentComparisonDataset | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  const normalizedRange = useMemo(() => {
    return {
      startIso: toIsoRangeFromInput(filters.startDate, false),
      endIso: toIsoRangeFromInput(filters.endDate, true),
      agentId: filters.agentId === 'all' ? null : filters.agentId,
    };
  }, [filters]);

  const fetchSeries = useCallback(async () => {
    try {
      setSeriesLoading(true);
      setSeriesError(null);
      const data = await getConversationSeries({
        start: normalizedRange.startIso,
        end: normalizedRange.endIso,
        agentId: normalizedRange.agentId,
      });
      setSeries(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('获取对话趋势失败');
      setSeriesError(message);
      toast({ type: 'error', title: message });
    } finally {
      setSeriesLoading(false);
    }
  }, [normalizedRange.startIso, normalizedRange.endIso, normalizedRange.agentId, t]);

  const fetchComparison = useCallback(async () => {
    try {
      setComparisonLoading(true);
      setComparisonError(null);
      const data = await getAgentComparison({
        start: normalizedRange.startIso,
        end: normalizedRange.endIso,
      });
      setComparison(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('获取智能体对比失败');
      setComparisonError(message);
      toast({ type: 'error', title: message });
    } finally {
      setComparisonLoading(false);
    }
  }, [normalizedRange.startIso, normalizedRange.endIso, t]);

  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);
    (async () => {
      try {
        const list = await listAgents({ includeInactive: true });
        if (cancelled) return;
        setAgents(list);
      } catch (err: any) {
        if (cancelled) return;
        const message = err?.message || t('获取智能体列表失败');
        toast({ type: 'error', title: message });
      } finally {
        if (!cancelled) {
          setAgentsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    void fetchSeries();
  }, [fetchSeries]);

  useEffect(() => {
    void fetchComparison();
  }, [fetchComparison]);

  const setDateFilter = useCallback((key: 'startDate' | 'endDate', value: string) => {
    if (!value) return;
    setFilters((prev) => {
      const next: ConversationAnalyticsFilters = { ...prev, [key]: value } as ConversationAnalyticsFilters;
      const startMs = dateInputToMs(next.startDate);
      const endMs = dateInputToMs(next.endDate);
      if (startMs > endMs) {
        if (key === 'startDate') {
          next.endDate = next.startDate;
        } else {
          next.startDate = next.endDate;
        }
      }
      return next;
    });
  }, []);

  const setAgentId = useCallback((agentId: string) => {
    setFilters((prev) => ({ ...prev, agentId }));
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchSeries(), fetchComparison()]);
  }, [fetchSeries, fetchComparison]);

  return {
    filters,
    setDateFilter,
    setAgentId,
    refresh,
    series,
    seriesLoading,
    seriesError,
    comparison,
    comparisonLoading,
    comparisonError,
    agents,
    agentsLoading,
  };
}

function ConversationsTrendCard({ analytics }: { analytics: DashboardConversationAnalytics }) {
  const { t } = useI18n();
  const {
    filters,
    setDateFilter,
    setAgentId,
    refresh,
    series,
    seriesLoading,
    seriesError,
    agents,
    agentsLoading,
    comparisonLoading,
  } = analytics;

  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((agent) => map.set(agent.id, agent.name));
    series?.agentTotals.forEach((item) => {
      if (!map.has(item.agentId)) {
        map.set(item.agentId, item.name);
      }
    });
    return map;
  }, [agents, series?.agentTotals]);

  const selectedAgentLabel = filters.agentId === 'all'
    ? t('全部智能体')
    : agentNameMap.get(filters.agentId) || t('未知智能体');

  const chartOption = useMemo(() => {
    if (!series || series.buckets.length === 0) {
      return null;
    }
    const agentIds = filters.agentId === 'all'
      ? series.agentTotals.slice(0, Math.min(series.agentTotals.length, 6)).map((item) => item.agentId)
      : [filters.agentId];
    if (agentIds.length === 0) {
      return null;
    }
    const xAxisLabels = series.buckets.map((bucket) => formatDateLabel(bucket.date));
    const legendLabels = agentIds.map((id) => agentNameMap.get(id) || id);
    const seriesData = agentIds.map((agentId) => ({
      name: agentNameMap.get(agentId) || agentId,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      data: series.buckets.map((bucket) => {
        const found = bucket.byAgent.find((entry) => entry.agentId === agentId);
        return found ? found.count : 0;
      }),
    }));

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: legendLabels, top: 0, textStyle: { color: 'var(--muted-foreground)' } },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisLabels,
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisLabel: { color: 'var(--muted-foreground)' },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(125,125,125,0.2)' } },
        axisLabel: { color: 'var(--muted-foreground)' },
      },
      series: seriesData,
    } as const;
  }, [series, filters.agentId, agentNameMap]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('对话趋势')}</h3>
          <p className="text-xs text-muted-foreground">{t('展示指定时间范围内的请求次数变化，可按智能体筛选')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex flex-col gap-1" htmlFor="analytics-start-date">
            <span className="text-muted-foreground">{t('开始日期')}</span>
            <input
              id="analytics-start-date"
              name="analytics-start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => setDateFilter('startDate', e.target.value)}
              className="h-9 rounded-lg border border-border/50 bg-transparent px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1" htmlFor="analytics-end-date">
            <span className="text-muted-foreground">{t('结束日期')}</span>
            <input
              id="analytics-end-date"
              name="analytics-end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => setDateFilter('endDate', e.target.value)}
              className="h-9 rounded-lg border border-border/50 bg-transparent px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 min-w-[160px]" htmlFor="analytics-agent-filter">
            <span className="text-muted-foreground">{t('智能体')}</span>
            <select
              id="analytics-agent-filter"
              name="analytics-agent-filter"
              value={filters.agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="h-9 rounded-lg border border-border/50 bg-transparent px-3 text-sm"
            >
              <option value="all">{t('全部智能体')}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.status === 'inactive' ? ` (${t('停用')})` : ''}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void refresh(); }}
            disabled={seriesLoading || comparisonLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${seriesLoading || comparisonLoading ? 'animate-spin' : ''}`} />
            <span>{seriesLoading || comparisonLoading ? t('刷新中...') : t('刷新')}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{t('当前筛选')}：{selectedAgentLabel}</span>
        <span>{t('统计范围')}：{formatDateRangeReadable(filters.startDate, filters.endDate)}</span>
        {series?.generatedAt && (
          <span>{t('数据更新时间')}：{formatTimestampReadable(series.generatedAt)}</span>
        )}
        {agentsLoading && <span>{t('智能体列表加载中...')}</span>}
      </div>

      {seriesError && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          {seriesError}
        </div>
      )}

      {seriesLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-muted/10 text-sm text-muted-foreground">
          {t('加载中...')}
        </div>
      ) : !chartOption ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-muted/10 text-sm text-muted-foreground">
          {t('暂无数据')}
        </div>
      ) : (
        <ReactECharts option={chartOption} style={{ height: 320 }} notMerge lazyUpdate />
      )}
    </div>
  );
}

function AgentComparisonCard({ analytics }: { analytics: DashboardConversationAnalytics }) {
  const { t } = useI18n();
  const { comparison, comparisonLoading, comparisonError, filters, seriesLoading } = analytics;

  const option = useMemo(() => {
    if (!comparison || comparison.totals.length === 0) {
      return null;
    }

    const categories = comparison.totals.map((item) => item.name);
    const data = comparison.totals.map((item) => item.count);

    const brandHex = (() => {
      if (typeof window === 'undefined') return '#6cb33f';
      const value = getComputedStyle(document.documentElement).getPropertyValue('--brand');
      return value?.trim() || '#6cb33f';
    })();

    const brandTint = (() => {
      if (!brandHex.startsWith('#')) {
        return 'rgba(108, 179, 63, 0.35)';
      }

      const expand = (hex: string) => (hex.length === 1 ? hex + hex : hex);
      const raw = brandHex.replace('#', '');
      if (![3, 6].includes(raw.length)) {
        return 'rgba(108, 179, 63, 0.35)';
      }

      const r = parseInt(expand(raw.slice(0, raw.length === 3 ? 1 : 2)), 16);
      const g = parseInt(expand(raw.slice(raw.length === 3 ? 1 : 2, raw.length === 3 ? 2 : 4)), 16);
      const b = parseInt(expand(raw.slice(raw.length === 3 ? 2 : 4)), 16);
      return `rgba(${r}, ${g}, ${b}, 0.3)`;
    })();

    const createGradient = (primary: string, tint: string) =>
      new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: primary },
        { offset: 1, color: tint },
      ]);

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: 'var(--muted-foreground)' },
        axisLine: { lineStyle: { color: 'var(--border)' } },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(125,125,125,0.2)' } },
        axisLabel: { color: 'var(--muted-foreground)' },
      },
      series: [
        {
          name: t('请求次数'),
          type: 'bar',
          barMaxWidth: 36,
          itemStyle: {
            color: createGradient(brandHex, brandTint),
            borderRadius: [8, 8, 4, 4],
            shadowColor: brandTint,
            shadowBlur: 12,
          },
          emphasis: {
            itemStyle: {
              color: createGradient(brandHex, brandHex),
              shadowColor: brandTint,
              shadowBlur: 18,
            },
          },
          data,
        },
      ],
    } as const;
  }, [comparison, t]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-foreground">{t('智能体请求对比')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('按智能体统计同一时间范围的请求次数，默认展示当前月份')}
        </p>
        <span className="text-xs text-muted-foreground">
          {t('统计范围')}：{formatDateRangeReadable(filters.startDate, filters.endDate)}
        </span>
        {comparison?.generatedAt && (
          <span className="text-[11px] text-muted-foreground">
            {t('数据更新时间')}：{formatTimestampReadable(comparison.generatedAt)}
          </span>
        )}
      </div>

      {comparisonError && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          {comparisonError}
        </div>
      )}

      {comparisonLoading || seriesLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-muted/10 text-sm text-muted-foreground">
          {t('加载中...')}
        </div>
      ) : !option ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-muted/10 text-sm text-muted-foreground">
          {t('暂无数据')}
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />
      )}
    </div>
  );
}

function ConversationSummaryCard({ analytics }: { analytics: DashboardConversationAnalytics }) {
  const { t } = useI18n();
  const { series, seriesLoading, filters, comparison, comparisonLoading } = analytics;

  const sparkValues = useMemo(() => {
    if (!series) return [] as number[];
    return series.buckets.map((bucket) => {
      if (filters.agentId === 'all') {
        return bucket.total;
      }
      const found = bucket.byAgent.find((entry) => entry.agentId === filters.agentId);
      return found ? found.count : 0;
    });
  }, [series, filters.agentId]);

  const total = series?.total ?? 0;
  const days = series?.buckets.length ?? 0;
  const average = days > 0 ? Math.round(total / days) : 0;
  const peak = sparkValues.length > 0 ? Math.max(...sparkValues) : 0;
  const peakIndex = sparkValues.findIndex((value) => value === peak);
  const peakDate = peakIndex >= 0 && series ? series.buckets[peakIndex]?.date : null;

  const topAgent = filters.agentId === 'all'
    ? comparison?.totals[0]
    : comparison?.totals.find((item) => item.agentId === filters.agentId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{t('对话概览')}</h3>
        <p className="text-xs text-muted-foreground">{t('快速了解当前筛选条件下的请求表现')}</p>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-foreground">{seriesLoading ? '—' : total}</span>
        <span className="text-xs text-muted-foreground">{t('总请求次数')}</span>
      </div>

      <div className="text-xs text-muted-foreground">
        {t('统计范围')}：{formatDateRangeReadable(filters.startDate, filters.endDate)}
      </div>

      <div className="h-16 flex items-end gap-[3px]">
        {seriesLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            {t('加载中...')}
          </div>
        ) : sparkValues.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            {t('暂无数据')}
          </div>
        ) : (
          sparkValues.map((value, idx) => {
            const max = Math.max(peak, 1);
            return (
              <div
                key={idx}
                className="flex-1 rounded-t bg-[var(--brand)]/40"
                style={{ height: `${(value / max) * 64 || 2}px` }}
              />
            );
          })
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div className="space-y-1">
          <div className="text-muted-foreground/80">{t('日均请求')}</div>
          <div className="text-sm font-semibold text-foreground">{seriesLoading ? '—' : average}</div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground/80">{t('峰值')}</div>
          <div className="text-sm font-semibold text-foreground">
            {seriesLoading ? '—' : peak}
            {peakDate ? <span className="ml-1 text-[11px] text-muted-foreground">{formatDateLabel(peakDate)}</span> : null}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground/80">{t('主力智能体')}</div>
          <div className="text-sm font-semibold text-foreground">
            {comparisonLoading && filters.agentId === 'all' ? '—' : (topAgent?.name || t('暂无数据'))}
          </div>
          {topAgent && (
            <div className="text-[11px] text-muted-foreground">{t('请求次数')}：{topAgent.count}</div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground/80">{t('更新时间')}</div>
          <div className="text-[11px] text-muted-foreground">
            {series?.generatedAt ? formatTimestampReadable(series.generatedAt) : t('暂无')}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardHeatmapCard() {
  const { t } = useI18n();
  const todayRange = useMemo(() => {
    const now = new Date();
    return {
      startIso: toIsoRangeFromDate(now, false),
      endIso: toIsoRangeFromDate(now, true),
      label: formatDateInputValue(now),
    };
  }, []);
  const [dataset, setDataset] = useState<ProvinceHeatmapDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProvinceHeatmap({
        start: todayRange.startIso,
        end: todayRange.endIso,
      });
      setDataset(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('获取数据失败');
      setError(message);
      toast({ type: 'error', title: message });
    } finally {
      setLoading(false);
    }
  }, [t, todayRange.startIso, todayRange.endIso]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.12 }}
      className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('今日请求热点地图')}</h3>
            <p className="text-xs text-muted-foreground">{t('展示当天各省份对 FastGPT 的请求热度')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{todayRange.label}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refresh()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? t('刷新中...') : t('刷新')}</span>
            </Button>
          </div>
        </div>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <HeatmapVisualization dataset={dataset} loading={loading} height={320} />
        <HeatmapSummary dataset={dataset} variant="compact" />
      </div>
    </motion.div>
  );
}

type AnalyticsFilters = { startDate: string; endDate: string; agentId: string };

function HeatmapVisualization({ dataset, loading, height = 360 }: { dataset: ProvinceHeatmapDataset | null; loading: boolean; height?: number; }) {
  const { t } = useI18n();

  const heatmapData = useMemo(
    () => (dataset?.points ?? []).map((item) => ({ name: item.province, value: item.count })),
    [dataset]
  );

  const maxValue = useMemo(() => {
    if (heatmapData.length === 0) return 0;
    return heatmapData.reduce((max, item) => Math.max(max, Number(item.value) || 0), 0);
  }, [heatmapData]);

  const hasData = useMemo(
    () => heatmapData.some((item) => Number(item.value) > 0),
    [heatmapData]
  );

  const option = useMemo(() => {
    const visualPalette = ['#dbeafe', '#2563eb'];

    return {
      tooltip: {
        trigger: 'item',
        borderRadius: 8,
        padding: 12,
        formatter: (params: any) => {
          const value = Array.isArray(params?.value) ? params?.value?.[0] : params?.value;
          return `${params?.name || ''}<br/>${t('请求量')}: ${value ?? 0}`;
        },
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        textStyle: { color: '#f8fafc' },
      },
      animation: true,
      animationEasing: 'cubicOut',
      animationDuration: 600,
      animationDurationUpdate: 800,
      animationEasingUpdate: 'cubicInOut',
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.05,
        scaleLimit: { min: 1, max: 5 },
        itemStyle: {
          areaColor: 'rgba(148, 163, 184, 0.08)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          shadowBlur: 14,
          shadowColor: 'rgba(15, 23, 42, 0.28)',
        },
        emphasis: {
          itemStyle: {
            borderColor: 'rgba(59, 130, 246, 0.8)',
            areaColor: 'rgba(59, 130, 246, 0.35)',
          },
          label: {
            show: true,
            color: '#fff',
            fontWeight: 600,
          },
        },
      },
      visualMap: hasData
        ? {
            min: 0,
            max: Math.max(maxValue, 1),
            left: 'left',
            bottom: 0,
            text: [t('高'), t('低')],
            calculable: true,
            inRange: { color: visualPalette },
          }
        : { show: false },
      series: [
        {
          name: t('请求量'),
          type: 'map',
          geoIndex: 0,
          emphasis: { label: { color: '#fff', fontWeight: 600 } },
          itemStyle: {
            borderColor: 'rgba(255,255,255,0.5)',
            borderWidth: 0.8,
          },
          data: heatmapData,
        },
      ],
    } as const;
  }, [heatmapData, hasData, maxValue, t]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-muted/10 text-sm text-muted-foreground"
        style={{ height }}
      >
        {t('加载中...')}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-background via-background/95 to-muted/20 shadow-inner"
      style={{ height }}
    >
      <ReactECharts option={option} style={{ height }} notMerge lazyUpdate className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background/75 via-background/25 to-transparent" />
      {!hasData && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs text-brand animate-pulse">
            {t('等待新的请求数据')}
          </div>
          <p className="max-w-sm px-4 text-center text-xs text-muted-foreground/80 md:text-sm">
            {t('当前时间范围内暂无省份请求记录，仍可自由缩放与浏览基础地图。')}
          </p>
        </div>
      )}
    </div>
  );
}

function HeatmapSummary({ dataset, variant = 'default' }: { dataset: ProvinceHeatmapDataset | null; variant?: 'default' | 'compact'; }) {
  const { t } = useI18n();
  if (!dataset) {
    return <div className="text-xs text-muted-foreground">{t('暂无请求数据')}</div>;
  }

  const topLimit = variant === 'compact' ? 3 : 5;
  const topItems = dataset.points.slice(0, topLimit);
  const topMax = topItems.reduce((max, item) => Math.max(max, item.count), 0) || 1;
  const startLabel = dataset.start.slice(0, 10);
  const endLabel = dataset.end.slice(0, 10);
  const spacingClass = variant === 'compact' ? 'space-y-2' : 'space-y-3';

  return (
    <div className={`text-sm ${spacingClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{t('总请求')}</span>
        <span className="font-semibold text-foreground">{dataset.total}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {t('统计范围')}：{startLabel} ~ {endLabel}
      </div>
      <div className="space-y-2">
        {topItems.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t('暂无省份分布')}</div>
        ) : (
          topItems.map((item) => {
            const widthRaw = (item.count / topMax) * 100;
            const widthPercent = item.count === 0
              ? 0
              : Math.min(100, Math.max(10, Number.isFinite(widthRaw) ? widthRaw : 0));
            return (
              <div key={item.province} className="flex items-center gap-3">
                <span className="w-16 text-xs text-muted-foreground truncate">{item.province}</span>
                <div className="flex-1 h-2 rounded bg-muted/30">
                  <div
                    className="h-2 rounded bg-[var(--brand)]/60"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-medium text-foreground">{item.count}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <span>{t('海外')}：<span className="font-medium text-foreground">{dataset.summary.overseas}</span></span>
        <span>{t('本地/内网')}：<span className="font-medium text-foreground">{dataset.summary.local}</span></span>
        <span>{t('未知')}：<span className="font-medium text-foreground">{dataset.summary.unknown}</span></span>
      </div>
    </div>
  );
}


function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toIsoRangeFromDate(date: Date, endOfDay: boolean): string {
  const next = new Date(date);
  if (endOfDay) {
    next.setHours(23, 59, 59, 999);
  } else {
    next.setHours(0, 0, 0, 0);
  }
  return next.toISOString();
}

function toIsoRangeFromInput(value: string, endOfDay: boolean): string {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = parseInt(yearStr || '', 10);
  const month = parseInt(monthStr || '', 10);
  const day = parseInt(dayStr || '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return toIsoRangeFromDate(new Date(), endOfDay);
  }
  const date = new Date();
  date.setFullYear(year, Math.max(0, month - 1), day);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

function dateInputToMs(value: string): number {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = parseInt(yearStr || '', 10);
  const month = parseInt(monthStr || '', 10);
  const day = parseInt(dayStr || '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return 0;
  }
  const date = new Date();
  date.setFullYear(year, Math.max(0, month - 1), day);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDateLabel(value: string): string {
  const [, monthStr, dayStr] = value.split('-');
  const month = parseInt(monthStr || '', 10);
  const day = parseInt(dayStr || '', 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return value;
  }
  return `${month}/${day}`;
}

function formatDateRangeReadable(start: string, end: string): string {
  const normalize = (input: string) => input.replace(/-/g, '/');
  return `${normalize(start)} ~ ${normalize(end)}`;
}

function formatTimestampReadable(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function ServerParamsCard() {
  const { t } = useI18n();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await getSystemInfo();
        setInfo(d);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const memPercent = info?.memory?.total ? Math.round((info.memory.used / info.memory.total) * 100) : null;
  return (
    <div className="space-y-3 text-sm">
      {loading && <div className="text-muted-foreground">{t('加载中...')}</div>}
      {!loading && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('内存使用')}</span>
            <span className="font-medium">{memPercent !== null ? `${memPercent}%` : 'N/A'}</span>
          </div>
          <div className="h-2 w-full bg-muted/30 rounded">
            <div className="h-2 bg-[var(--brand)]/60 rounded" style={{ width: `${memPercent ?? 0}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('GPU 使用')}</span>
            <span className="font-medium">N/A</span>
          </div>
          <div className="h-2 w-full bg-muted/30 rounded">
            <div className="h-2 bg-[var(--brand)]/40 rounded" style={{ width: `0%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('磁盘使用')}</span>
            <span className="font-medium">N/A</span>
          </div>
          <div className="h-2 w-full bg-muted/30 rounded">
            <div className="h-2 bg-[var(--brand)]/40 rounded" style={{ width: `0%` }} />
          </div>
          <div className="text-xs text-muted-foreground">{t('提示：GPU/磁盘暂未从后端提供，需扩展 /admin/system-info 接口')}</div>
        </>
      )}
    </div>
  );
}

export function ConversationsLineChart() {
  // 生成近30天日期
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  // 模拟 3 个智能体数据
  const agents = ["FastGPT", "OpenAI", "Anthropic"];
  const series = agents.map((name, idx) => ({
    name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2 },
    data: dates.map((_, di) => 10 + ((di * (idx+1)) % 8) + (idx*3)),
  }));
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    legend: { data: agents, top: 0, textStyle: { color: 'var(--muted-foreground)' } },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: 'var(--border)' } },
      axisLabel: { color: 'var(--muted-foreground)' },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(125,125,125,0.2)' } },
      axisLabel: { color: 'var(--muted-foreground)' },
    },
    series,
  } as const;
  return <ReactECharts option={option} style={{ height: 320 }} notMerge={true} lazyUpdate={true} />;
}





function LogsPanel() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [level, setLevel] = useState<''|'INFO'|'WARN'|'ERROR'>('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [total, setTotal] = useState<number>(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchData = async (p = page) => {
    try {
      setLoading(true);
      const d = await getLogsPage({ level: level || undefined, start: start || undefined, end: end || undefined, page: p, pageSize });
      setLogs(d.data);
      setTotal(d.total);
      setErr(null);
    } catch (e) {
      setErr('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); setPage(1); }, [level, start, end]);

  const onExport = async () => {
    try {
      const csv = await exportLogsCsv({ level: level || undefined, start: start || undefined, end: end || undefined });
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
                onChange={e=>setLevel(e.target.value as any)}
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
                onChange={e=>setStart(e.target.value)}
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
                onChange={e=>setEnd(e.target.value)}
                className="h-9 px-2 rounded-md bg-muted/30 border border-border/30"
              />
            </div>
            <Button onClick={() => fetchData()}>{t('查询')}</Button>
            <Button variant="secondary" onClick={onExport}>{t('导出 CSV')}</Button>
          </div>

          <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
            <div>{t('共 {total} 条 | 第 {page} / {pages} 页', { total, page, pages: totalPages })}</div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={()=>{ const p=Math.max(1,page-1); setPage(p); fetchData(p); }} disabled={page<=1}>{t('上一页')}</Button>
              <Button variant="ghost" onClick={()=>{ const max=Math.max(1, Math.ceil(total / pageSize)); const p=Math.min(max, page+1); setPage(p); fetchData(p); }} disabled={page>=Math.max(1, Math.ceil(total / pageSize))}>{t('下一页')}</Button>
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
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td className="py-2">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${l.level==='ERROR'?'bg-red-100 text-red-700': l.level==='WARN'?'bg-yellow-100 text-yellow-800':'bg-sky-100 text-sky-700'}`}>{l.level}</span></td>
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

function UsersManagement() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { (async () => {
    try { setLoading(true); const d = await getUsers(); setUsers(d); setErr(null); }
    catch { setErr('加载用户失败'); } finally { setLoading(false); }
  })(); }, []);
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">{t('用户管理')}</h3>
            <Button onClick={async()=>{
              const username = window.prompt(t('请输入新用户名'));
              if (!username) return;
              const password = window.prompt(t('请输入初始密码（至少6位）')) || '';
              try {
                const u = await createUser({ username, password });
                setUsers((prev)=>[u, ...prev]);
              } catch (e:any) { toast({ type:'error', title: e?.response?.data?.message || t('创建失败') }); }
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
                      <td className="py-2">{u.role || '-'}</td>
                      <td className="py-2">{u.status || '-'}</td>
                      <td className="py-2">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>


                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" onClick={async()=>{
                            const next = u.status === 'active' ? 'disabled' : 'active';
                            const nu = await updateUser({ id: u.id!, status: next });
                            setUsers(prev=> prev.map(x=> x.id===u.id? nu: x));
                          }}>{u.status === 'active' ? t('禁用') : t('启用')}</Button>
                          <Button variant="ghost" onClick={async()=>{
                            const ret = await resetUserPassword({ id: u.id! });
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
}

function AnalyticsPanel() {
  const { t } = useI18n();
  const initialFilters = useMemo<AnalyticsFilters>(() => {
    const now = new Date();
    const day = formatDateInputValue(now);
    return { startDate: day, endDate: day, agentId: 'all' };
  }, []);

  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [dataset, setDataset] = useState<ProvinceHeatmapDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentOptions, setAgentOptions] = useState<AgentItem[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const fetchDataset = useCallback(async (target: AnalyticsFilters) => {
    if (!target.startDate || !target.endDate) {
      const message = t('请选择起止日期');
      setError(message);
      toast({ type: 'warning', title: message });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const startIso = toIsoRangeFromInput(target.startDate, false);
      const endIso = toIsoRangeFromInput(target.endDate, true);
      const data = await getProvinceHeatmap({
        start: startIso,
        end: endIso,
        agentId: target.agentId === 'all' ? undefined : target.agentId,
      });
      setDataset(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t('获取数据失败');
      setError(message);
      toast({ type: 'error', title: message });
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleApply = useCallback(() => {
    void fetchDataset(filters);
  }, [fetchDataset, filters]);

  const handleReset = useCallback(() => {
    setFilters(initialFilters);
    void fetchDataset(initialFilters);
  }, [fetchDataset, initialFilters]);

  useEffect(() => {
    void fetchDataset(initialFilters);
  }, [fetchDataset, initialFilters]);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoadingAgents(true);
        const list = await listAgents({ includeInactive: true });
        setAgentOptions(list);
      } catch (err) {
        console.warn('[AnalyticsPanel] load agents failed:', err);
      } finally {
        setLoadingAgents(false);
      }
    };
    void loadAgents();
  }, []);

  const onStartChange = (value: string) => {
    setFilters((prev) => {
      const next: AnalyticsFilters = { ...prev, startDate: value };
      if (value && prev.endDate && value > prev.endDate) {
        next.endDate = value;
      }
      return next;
    });
  };

  const onEndChange = (value: string) => {
    setFilters((prev) => {
      const next: AnalyticsFilters = { ...prev, endDate: value };
      if (value && prev.startDate && value < prev.startDate) {
        next.startDate = value;
      }
      return next;
    });
  };

  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <div className="mb-6 space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t('数据分析')}</h3>
            <p className="text-sm text-muted-foreground">{t('按省份查看不同时间段与智能体的 FastGPT 请求热点。')}</p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">{t('开始日期')}</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  max={filters.endDate || undefined}
                  onChange={(e) => onStartChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">{t('结束日期')}</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  min={filters.startDate || undefined}
                  onChange={(e) => onEndChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">{t('智能体')}</label>
                <select
                  value={filters.agentId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, agentId: e.target.value }))}
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                  disabled={loadingAgents}
                >
                  <option value="all">{t('全部智能体')}</option>
                  {agentOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.id}
                      {agent.status === 'inactive' ? ` · ${t('未激活')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleApply} disabled={loading}>
                {loading ? t('加载中...') : t('查询')}
              </Button>
              <Button variant="ghost" onClick={handleReset} disabled={loading}>
                {t('重置')}
              </Button>
              {dataset && (
                <span className="text-xs text-muted-foreground">
                  {t('数据更新时间')}：{new Date(dataset.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <HeatmapVisualization dataset={dataset} loading={loading} height={420} />
            <HeatmapSummary dataset={dataset} />
          </div>
        </div>
      </div>
    </main>
  );
}

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

function ChangePasswordDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) {
  const { t } = useI18n();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const onSubmit = async () => {
    if (!oldPwd || !newPwd) { toast({ type: 'warning', title: t('请输入完整信息') }); return; }
    if (newPwd !== confirmPwd) { toast({ type: 'error', title: t('两次输入的新密码不一致') }); return; }
    try {
      setLoading(true);
      await changePasswordApi(oldPwd, newPwd);
      toast({ type: 'success', title: t('修改密码成功，请重新登录') });
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.message || t('修改失败');
      toast({ type: 'error', title: msg });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">


      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md p-6 rounded-2xl bg-background border border-border/50 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t('修改密码')}</h3>
        <div className="space-y-3">
          <Input type="password" placeholder={t('原密码')} value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
          <Input type="password" placeholder={t('新密码')} value={newPwd} onChange={e => setNewPwd(e.target.value)} />
          <Input type="password" placeholder={t('确认新密码')} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>{t('取消')}</Button>
          <Button onClick={onSubmit} disabled={loading}>{loading ? t('提交中...') : t('确定')}</Button>
        </div>
      </motion.div>
    </div>
  );
}


function AgentsPanel() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formState, setFormState] = useState<{ open: boolean; mode: "create" | "edit"; agent: AgentItem | null }>({
    open: false,
    mode: "create",
    agent: null,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [toggleId, setToggleId] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listAgents({ includeInactive: true });
      setAgents(list);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('加载智能体失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const sorted = [...agents].sort((a, b) => {
      const getTs = (item: AgentItem) =>
        item.updatedAt ? new Date(item.updatedAt).getTime() : item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return getTs(b) - getTs(a);
    });
    if (!keyword) {
      return sorted;
    }
    return sorted.filter((agent) => {
      const bucket = [agent.id, agent.name, agent.model, agent.provider, agent.description]
        .map((value) => (value || "").toLowerCase())
        .join(" ");
      return bucket.includes(keyword);
    });
  }, [agents, search]);

  const handleReload = useCallback(async () => {
    try {
      setReloading(true);
      await reloadAgents();
      await fetchAgents();
      toast({ type: "success", title: t('已重新加载智能体配置') });
    } catch (err) {
      console.error(err);
      toast({ type: "error", title: t('重新加载失败'), description: t('请稍后重试') });
    } finally {
      setReloading(false);
    }
  }, [fetchAgents, t]);

  const handleValidate = async (agent: AgentItem) => {
    try {
      setValidatingId(agent.id);
      const result = await validateAgent(agent.id);
      toast({
        type: result.isValid ? "success" : "error",
        title: result.isValid ? t('配置校验通过') : t('配置校验失败'),
        description: result.isValid
          ? t('{name} 可正常使用', { name: agent.name || agent.id })
          : t('请检查密钥、模型或访问地址是否正确'),
      });
    } catch (err) {
      console.error(err);
      toast({ type: "error", title: t('校验失败'), description: t('网络异常或服务不可用') });
    } finally {
      setValidatingId(null);
    }
  };

  const handleToggleActive = async (agent: AgentItem) => {
    try {
      setToggleId(agent.id);
      const updated = await updateAgentApi(agent.id, { isActive: agent.status !== "active" });
      setAgents((prev) => prev.map((item) => (item.id === agent.id ? updated : item)));
      toast({
        type: "success",
        title: updated.status === "active" ? t('已启用智能体') : t('已停用智能体'),
        description: updated.name,
      });
    } catch (err) {
      console.error(err);
      toast({ type: "error", title: t('更新状态失败'), description: t('请稍后重试') });
    } finally {
      setToggleId(null);
    }
  };

  const handleFormSubmit = async (payload: AgentPayload) => {
    try {
      setFormSubmitting(true);
      if (formState.mode === "create") {
        const created = await createAgent(payload);
        setAgents((prev) => {
          const next = [created, ...prev.filter((item) => item.id !== created.id)];
          return next;
        });
        toast({ type: "success", title: t('已创建智能体'), description: created.name });
      } else if (formState.agent) {
        const { id: ignored, ...rest } = payload;
        const updates: Partial<AgentPayload> = { ...rest };
        if (!payload.apiKey) {
          delete updates.apiKey;
        }
        const updated = await updateAgentApi(formState.agent.id, updates);
        setAgents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast({ type: "success", title: t('已更新智能体'), description: updated.name });
      }
      setFormState({ open: false, mode: "create", agent: null });
    } catch (err: any) {
      console.error(err);
      toast({
        type: "error",
        title: formState.mode === "create" ? t('创建智能体失败') : t('更新智能体失败'),
        description: err?.response?.data?.message || t('请检查填写内容或稍后再试'),
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleImport = async (items: AgentPayload[]) => {
    try {
      setImportSubmitting(true);
      const imported = await importAgents({ agents: items });
      setAgents((prev) => {
        const map = new Map<string, AgentItem>();
        prev.forEach((item) => map.set(item.id, item));
        imported.forEach((item) => map.set(item.id, item));
        return Array.from(map.values());
      });
      toast({ type: "success", title: t('导入成功'), description: t('已同步 {count} 个智能体', { count: imported.length }) });
      setImportOpen(false);
    } catch (err: any) {
      console.error(err);
      toast({
        type: "error",
        title: t('导入失败'),
        description: err?.response?.data?.message || t('请确认 JSON 格式是否正确'),
      });
    } finally {
      setImportSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await deleteAgent(deleteTarget.id);
      setAgents((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast({ type: "success", title: t('已删除智能体'), description: deleteTarget.name || deleteTarget.id });
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      toast({ type: "error", title: t('删除失败'), description: t('请稍后重试') });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="rounded-2xl border border-border/50 bg-background/90 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground">{t('智能体管理')}</h3>
                <p className="text-sm text-muted-foreground">{t('统一维护 FASTGPT 智能体配置，支持增删改与批量导入。')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  radius="md"
                  onClick={() => setImportOpen(true)}
                  disabled={loading}
                >
                  <Upload className="mr-2 h-4 w-4" />{t('批量导入')}
                </Button>
                <Button
                  variant="outline"
                  radius="md"
                  onClick={handleReload}
                  disabled={loading || reloading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${reloading ? "animate-spin" : ""}`} />{t('重新加载')}
                </Button>
                <Button
                  radius="md"
                  onClick={() => setFormState({ open: true, mode: "create", agent: null })}
                >
                  <Plus className="mr-2 h-4 w-4" />{t('新建智能体')}
                </Button>
              </div>
            </div>

            <div className="relative">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('搜索名称、模型或提供方')}
                className="pl-10 pr-4 h-11 rounded-xl"
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="h-16 animate-pulse rounded-xl bg-muted/40" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {t(error)}
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                {t('暂无智能体数据，点击“新建智能体”完成首个配置。')}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="hidden overflow-x-auto rounded-xl border border-border/50 lg:block">
                  <table className="min-w-full divide-y divide-border/60 text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">{t('名称')}</th>
                        <th className="px-4 py-3 text-left">{t('模型')}</th>
                        <th className="px-4 py-3 text-left">{t('提供方')}</th>
                        <th className="px-4 py-3 text-left">{t('状态')}</th>
                        <th className="px-4 py-3 text-left">{t('更新时间')}</th>
                        <th className="px-4 py-3 text-right">{t('操作')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-muted/30">
                          <td className="px-4 py-4">
                            <div className="font-medium text-foreground">{agent.name || agent.id}</div>
                            <div className="text-xs text-muted-foreground">{agent.description || agent.id}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-foreground">{agent.model || "-"}</div>
                            {agent.capabilities && agent.capabilities.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {agent.capabilities.map((cap) => (
                                  <span key={cap} className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">
                                    {cap}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{agent.provider || "-"}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                agent.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {agent.status === "active" ? t('已启用') : t('已停用')}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {agent.updatedAt ? new Date(agent.updatedAt).toLocaleString() : "-"}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFormState({ open: true, mode: "edit", agent })}
                              >
                                <Edit className="mr-1 h-4 w-4" />{t('编辑')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleValidate(agent)}
                                disabled={validatingId === agent.id}
                              >
                                {validatingId === agent.id ? (
                                  <ShieldAlert className="mr-1 h-4 w-4 animate-pulse" />
                                ) : (
                                  <ShieldCheck className="mr-1 h-4 w-4" />
                                )}
                                {t('校验')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(agent)}
                                disabled={toggleId === agent.id}
                              >
                                <RefreshCw className={`mr-1 h-4 w-4 ${toggleId === agent.id ? "animate-spin" : ""}`} />
                                {agent.status === "active" ? t('停用') : t('启用')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(agent)}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />{t('删除')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 lg:hidden">
                  {filteredAgents.map((agent) => (
                    <div key={agent.id} className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-foreground">{agent.name || agent.id}</div>
                          <div className="text-xs text-muted-foreground">{agent.description || agent.id}</div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            agent.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {agent.status === "active" ? t('已启用') : t('已停用')}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div>{t('模型：{value}', { value: agent.model || '-' })}</div>
                        <div>{t('提供方：{value}', { value: agent.provider || '-' })}</div>
                        <div>{t('更新时间：{value}', { value: agent.updatedAt ? new Date(agent.updatedAt).toLocaleString() : '-' })}</div>
                      </div>
                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {agent.capabilities.map((cap) => (
                            <span key={cap} className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setFormState({ open: true, mode: "edit", agent })}
                        >
                          <Edit className="mr-1 h-4 w-4" />{t('编辑')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleActive(agent)}
                          disabled={toggleId === agent.id}
                        >
                          <RefreshCw className={`mr-1 h-4 w-4 ${toggleId === agent.id ? "animate-spin" : ""}`} />
                          {agent.status === "active" ? t('停用') : t('启用')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleValidate(agent)}
                          disabled={validatingId === agent.id}
                        >
                          <ShieldCheck className="mr-1 h-4 w-4" />{t('校验')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(agent)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />{t('删除')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AgentFormDialog
        open={formState.open}
        mode={formState.mode}
        agent={formState.agent}
        submitting={formSubmitting}
        onClose={() => setFormState({ open: false, mode: "create", agent: null })}
        onSubmit={handleFormSubmit}
      />
      <ImportAgentsDialog
        open={importOpen}
        submitting={importSubmitting}
        onClose={() => setImportOpen(false)}
        onSubmit={handleImport}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('删除智能体')}
        description={deleteTarget ? t('确认删除「{name}」？删除后该智能体将无法被用户选择。', { name: deleteTarget.name || deleteTarget.id || '' }) : undefined}
        destructive
        confirmText={deleteLoading ? t('删除中...') : t('确认删除')}
        cancelText={t('取消')}
        onConfirm={deleteLoading ? undefined : handleDelete}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteTarget(null);
        }}
      />
    </main>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText,
  destructive,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  if (!open) return null;
  const resolvedTitle = title ?? t('确认操作');
  const resolvedConfirm = confirmText ?? t('确认');
  const resolvedCancel = cancelText ?? t('取消');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[61] w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl">
        <div className="p-4 sm:p-5">
          <div className="text-base font-semibold text-foreground">{resolvedTitle}</div>
          {description && (
            <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {description}
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="md"
              radius="md"
              onClick={onClose}
              className="min-w-[84px]"
            >
              {resolvedCancel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'brand'}
              size="md"
              radius="md"
              onClick={() => onConfirm?.()}
              className="min-w-[84px]"
            >
              {resolvedConfirm}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AgentFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  agent: AgentItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: AgentPayload) => Promise<void> | void;
}

function AgentFormDialog({ open, mode, agent, submitting, onClose, onSubmit }: AgentFormDialogProps) {
  const { t } = useI18n();
  const [localError, setLocalError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    provider: "",
    endpoint: "",
    apiKey: "",
    appId: "",
    model: "",
    maxTokens: "",
    temperature: "",
    systemPrompt: "",
    rateLimitRequests: "",
    rateLimitTokens: "",
  });
  const [capabilitiesInput, setCapabilitiesInput] = useState("");
  const [featuresInput, setFeaturesInput] = useState("");
  const [isActive, setIsActive] = useState(true);
  
  // 字段验证状态
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  
  // 自动获取智能体信息功能
  const { fetchAgentInfo, loading: fetching, error: fetchError } = useAgentAutoFetch();
  
  // 检测是否可以自动获取（FastGPT或Dify且有必填信息）
  const canAutoFetch = 
    (form.provider === 'fastgpt' || form.provider === 'dify') &&
    form.endpoint.trim() &&
    form.apiKey.trim() &&
    (form.provider === 'dify' || form.appId.trim());
  
  // 实时验证endpoint
  const handleEndpointBlur = async () => {
    if (!form.endpoint.trim()) return;
    
    setValidating(prev => ({ ...prev, endpoint: true }));
    const result = await validateEndpoint(form.endpoint);
    setValidating(prev => ({ ...prev, endpoint: false }));
    
    if (!result.valid) {
      setFieldErrors(prev => ({ ...prev, endpoint: result.message || '接口地址无效' }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.endpoint;
        return next;
      });
      // 显示警告信息（如CORS）
      if (result.message) {
        setFieldErrors(prev => ({ ...prev, endpoint: result.message || '' }));
      }
    }
  };
  
  // 实时验证API Key
  const handleApiKeyBlur = () => {
    if (!form.apiKey.trim() && mode === 'edit') return; // 编辑模式可选
    if (!form.apiKey.trim()) return;
    
    const result = validateApiKey(form.apiKey, form.provider);
    if (!result.valid) {
      setFieldErrors(prev => ({ ...prev, apiKey: result.message || 'API密钥格式不正确' }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.apiKey;
        return next;
      });
    }
  };
  
  // 实时验证App ID
  const handleAppIdBlur = () => {
    if (form.provider !== 'fastgpt') return;
    if (!form.appId.trim()) {
      setFieldErrors(prev => ({ ...prev, appId: 'FastGPT必须提供App ID' }));
      return;
    }
    
    const result = validateAppId(form.appId);
    if (!result.valid) {
      setFieldErrors(prev => ({ ...prev, appId: result.message || 'App ID格式不正确' }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.appId;
        return next;
      });
    }
  };
  
  // 实时验证Model
  const handleModelBlur = () => {
    if (!form.model.trim()) return;
    
    const result = validateModel(form.model);
    if (!result.valid) {
      setFieldErrors(prev => ({ ...prev, model: result.message || '模型名称无效' }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.model;
        return next;
      });
    }
  };
  
  // 实时验证Temperature
  const handleTemperatureBlur = () => {
    if (!form.temperature.trim()) return;
    
    const result = validateTemperature(form.temperature);
    if (!result.valid) {
      setFieldErrors(prev => ({ ...prev, temperature: result.message || '温度值无效' }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.temperature;
        return next;
      });
    }
  };
  
  // 实时验证MaxTokens
  const handleMaxTokensBlur = () => {
    if (!form.maxTokens.trim()) return;
    
    const result = validateMaxTokens(form.maxTokens);
    if (!result.valid) {
      setFieldErrors(prev => ({ ...prev, maxTokens: result.message || '最大Token无效' }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.maxTokens;
        return next;
      });
    }
  };

  const handleAutoFetch = async () => {
    if (!canAutoFetch) return;
    
    try {
      const info = await fetchAgentInfo({
        provider: form.provider as 'fastgpt' | 'dify',
        endpoint: form.endpoint.trim(),
        apiKey: form.apiKey.trim(),
        appId: form.appId.trim() || undefined,
      });
      
      if (info) {
        setForm(prev => ({
          ...prev,
          name: info.name || prev.name,
          description: info.description || prev.description,
          model: info.model || prev.model,
          systemPrompt: info.systemPrompt || prev.systemPrompt,
          temperature: info.temperature != null ? String(info.temperature) : prev.temperature,
          maxTokens: info.maxTokens != null ? String(info.maxTokens) : prev.maxTokens,
        }));
        setCapabilitiesInput(info.capabilities?.join(', ') || capabilitiesInput);
        setFeaturesInput(info.features ? JSON.stringify(info.features, null, 2) : featuresInput);
        setLocalError(null);
      }
    } catch (err) {
      setLocalError(fetchError || '自动获取失败');
    }
  };

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setFieldErrors({}); // 清空字段错误
    setForm({
      id: agent?.id || "",
      name: agent?.name || "",
      description: agent?.description || "",
      provider: agent?.provider || "",
      endpoint: agent?.endpoint || "",
      apiKey: "",
      appId: agent?.appId || "",
      model: agent?.model || "",
      maxTokens: agent?.maxTokens != null ? String(agent.maxTokens) : "",
      temperature: agent?.temperature != null ? String(agent.temperature) : "",
      systemPrompt: agent?.systemPrompt || "",
      rateLimitRequests: agent?.rateLimit?.requestsPerMinute != null ? String(agent.rateLimit.requestsPerMinute) : "",
      rateLimitTokens: agent?.rateLimit?.tokensPerMinute != null ? String(agent.rateLimit.tokensPerMinute) : "",
    });
    setCapabilitiesInput(agent?.capabilities?.join(", ") || "");
    setFeaturesInput(agent?.features ? JSON.stringify(agent.features, null, 2) : "");
    setIsActive(agent?.status ? agent.status === "active" : true);
  }, [agent, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.provider.trim() || !form.endpoint.trim() || !form.model.trim()) {
      setLocalError('请填写名称、提供方、接口地址和模型等必填信息');
      return;
    }
    if (mode === "create" && !form.apiKey.trim()) {
      setLocalError('创建智能体时需要填写访问密钥');
      return;
    }

    const capabilities = capabilitiesInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    let features: Record<string, any> | undefined;
    if (featuresInput.trim()) {
      try {
        const parsed = JSON.parse(featuresInput);
        if (typeof parsed === "object" && parsed !== null) {
          features = parsed as Record<string, any>;
        } else {
          throw new Error("features must be object");
        }
      } catch (err) {
        setLocalError('功能配置（features）不是有效的 JSON 对象');
        return;
      }
    }

    const payload: AgentPayload = {
      id: form.id || undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      provider: form.provider.trim(),
      endpoint: form.endpoint.trim(),
      apiKey: form.apiKey.trim(),
      appId: form.appId.trim() || undefined,
      model: form.model.trim(),
      maxTokens: form.maxTokens.trim() ? Number(form.maxTokens) : undefined,
      temperature: form.temperature.trim() ? Number(form.temperature) : undefined,
      systemPrompt: form.systemPrompt.trim() || undefined,
      capabilities,
      rateLimit:
        form.rateLimitRequests.trim() || form.rateLimitTokens.trim()
          ? {
              requestsPerMinute: form.rateLimitRequests.trim() ? Number(form.rateLimitRequests) : undefined,
              tokensPerMinute: form.rateLimitTokens.trim() ? Number(form.rateLimitTokens) : undefined,
            }
          : undefined,
      isActive,
      features,
    };

    try {
      await onSubmit(payload);
    } catch (err: any) {
      setLocalError(err?.message || '提交失败，请稍后重试');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => (!submitting ? onClose() : null)} />
      <div className="relative z-[71] mx-4 w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
          <div>
            <h4 className="text-lg font-semibold text-foreground">{mode === "create" ? t('新建智能体') : t('编辑智能体')}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('提供基础配置、访问凭证和能力标签，保存后将同步至所有前端终端。')}
            </p>
          </div>

          {canAutoFetch && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {t('检测到 FastGPT/Dify 智能体，可自动获取配置信息')}
                </p>
                <Button
                  type="button"
                  onClick={handleAutoFetch}
                  disabled={fetching}
                  className="text-xs"
                >
                  {fetching ? t('获取中...') : t('自动获取')}
                </Button>
              </div>
              {fetchError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fetchError}</p>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('名称 *')}</label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('例如：标准知识库助手')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('模型 *')}</label>
              <Input
                value={form.model}
                onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                onBlur={handleModelBlur}
                placeholder={t('gpt-4o-mini')}
                className={fieldErrors.model ? 'border-red-500' : ''}
              />
              {fieldErrors.model && (
                <p className="text-xs text-red-600">{fieldErrors.model}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                {t('提供方 *')}
                <HelpIcon content={getFieldTooltip('provider')} />
              </label>
              <Input
                value={form.provider}
                onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
                placeholder={t('fastgpt / dify / openai / anthropic / custom')}
              />
              <p className="text-xs text-muted-foreground">{t('支持 fastgpt 和 dify 自动获取配置')}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                {t('接口地址 *')}
                <HelpIcon content={getFieldTooltip('endpoint')} />
              </label>
              <Input
                value={form.endpoint}
                onChange={(event) => setForm((prev) => ({ ...prev, endpoint: event.target.value }))}
                onBlur={handleEndpointBlur}
                placeholder={t('https://api.example.com/v1/chat')}
                className={fieldErrors.endpoint ? 'border-red-500' : ''}
              />
              {validating.endpoint && (
                <p className="text-xs text-blue-600">{t('验证中...')}</p>
              )}
              {fieldErrors.endpoint && (
                <p className={`text-xs ${fieldErrors.endpoint.includes('⚠️') ? 'text-yellow-600' : 'text-red-600'}`}>
                  {fieldErrors.endpoint}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                {t('访问密钥 {suffix}', { suffix: mode === 'create' ? '*' : t('(留空则不变)') })}
                <HelpIcon content={getFieldTooltip('apiKey')} />
              </label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                onBlur={handleApiKeyBlur}
                placeholder={mode === "create" ? t('sk-...') : t('不修改则留空')}
                className={fieldErrors.apiKey ? 'border-red-500' : ''}
              />
              {fieldErrors.apiKey && (
                <p className="text-xs text-red-600">{fieldErrors.apiKey}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                {t('App ID')} {form.provider === 'fastgpt' && <span className="text-red-500">*</span>}
                <HelpIcon content={getFieldTooltip('appId')} />
              </label>
              <Input
                value={form.appId}
                onChange={(event) => setForm((prev) => ({ ...prev, appId: event.target.value }))}
                onBlur={handleAppIdBlur}
                placeholder={form.provider === 'fastgpt' ? t('FastGPT 应用ID（必填）') : t('可选')}
                className={fieldErrors.appId ? 'border-red-500' : ''}
              />
              {form.provider === 'fastgpt' && !fieldErrors.appId && (
                <p className="text-xs text-muted-foreground">{t('FastGPT 智能体必须提供 App ID（24位十六进制）')}</p>
              )}
              {fieldErrors.appId && (
                <p className="text-xs text-red-600">{fieldErrors.appId}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                {t('温度')}
                <HelpIcon content={getFieldTooltip('temperature')} />
              </label>
              <Input
                value={form.temperature}
                onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))}
                onBlur={handleTemperatureBlur}
                placeholder={t('0-2，可选')}
                className={fieldErrors.temperature ? 'border-red-500' : ''}
              />
              {fieldErrors.temperature && (
                <p className="text-xs text-red-600">{fieldErrors.temperature}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                {t('最大 Token')}
                <HelpIcon content={getFieldTooltip('maxTokens')} />
              </label>
              <Input
                value={form.maxTokens}
                onChange={(event) => setForm((prev) => ({ ...prev, maxTokens: event.target.value }))}
                onBlur={handleMaxTokensBlur}
                placeholder={t('1-32768，可选')}
                className={fieldErrors.maxTokens ? 'border-red-500' : ''}
              />
              {fieldErrors.maxTokens && (
                <p className="text-xs text-red-600">{fieldErrors.maxTokens}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('限流 - 次数/分钟')}</label>
              <Input
                value={form.rateLimitRequests}
                onChange={(event) => setForm((prev) => ({ ...prev, rateLimitRequests: event.target.value }))}
                placeholder={t('例如 60')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('限流 - Token/分钟')}</label>
              <Input
                value={form.rateLimitTokens}
                onChange={(event) => setForm((prev) => ({ ...prev, rateLimitTokens: event.target.value }))}
                placeholder={t('例如 90000')}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('能力标签（逗号分隔）')}</label>
              <Input
                value={capabilitiesInput}
                onChange={(event) => setCapabilitiesInput(event.target.value)}
                placeholder={t('文档问答, 多模态, 快速响应')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('是否启用')}</label>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-border/60 px-4">
                <input
                  id="agent-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                <label htmlFor="agent-active" className="text-sm text-foreground">
                  {isActive ? t('启用') : t('停用')}
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('系统提示词')}</label>
            <textarea
              value={form.systemPrompt}
              onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder={t('可选：提供给模型的角色设定')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('描述')}</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder={t('用于用户界面展示的简介')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('功能配置（JSON）')}</label>
            <textarea
              value={featuresInput}
              onChange={(event) => setFeaturesInput(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder={t('例如：{\n  "search": true\n}')}
            />
          </div>

          {localError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {t(localError)}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="sm:min-w-[120px]"
              onClick={() => (!submitting ? onClose() : null)}
              disabled={submitting}
            >
              {t('取消')}
            </Button>
            <Button type="submit" className="sm:min-w-[140px]" disabled={submitting}>
              {submitting ? t('保存中...') : mode === "create" ? t('创建') : t('保存')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ImportAgentsDialogProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (items: AgentPayload[]) => Promise<void> | void;
}

function ImportAgentsDialog({ open, submitting, onClose, onSubmit }: ImportAgentsDialogProps) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInput("");
    setError(null);
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(input || "{}");
      const agents: AgentPayload[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.agents)
        ? parsed.agents
        : [];
      if (!agents.length) {
        setError('请输入包含智能体数组的 JSON 内容');
        return;
      }
      await onSubmit(agents);
    } catch (err) {
      console.error(err);
      setError('JSON 解析失败，请确认格式是否正确');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => (!submitting ? onClose() : null)} />
      <div className="relative z-[66] mx-4 w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
          <div>
            <h4 className="text-lg font-semibold text-foreground">{t('批量导入智能体')}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('支持粘贴 agent.json 或包含 agents 数组的 JSON，导入后将覆盖同 ID 的配置。')}
            </p>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={12}
            className="w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder={t('粘贴 agent.json 内容')}
          />
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {t(error)}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="sm:min-w-[120px]"
              onClick={() => (!submitting ? onClose() : null)}
              disabled={submitting}
            >
              {t('取消')}
            </Button>
            <Button type="submit" className="sm:min-w-[140px]" disabled={submitting}>
              {submitting ? t('导入中...') : t('导入')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
