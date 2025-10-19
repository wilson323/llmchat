import { create } from 'zustand';

// 类型安全的Store辅助类型
type SetState<T> = (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void;
type GetState<T> = () => T;

// 用户信息接口
export interface AuthUser {
  id: string;
  username: string;
  role?: string;
  email?: string;
  avatar?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

// 登录载荷接口
export interface LoginPayload {
  token: string;
  user: AuthUser;
  expiresIn: number; // 秒
}

// 状态类型定义
interface AuthState {
  token: string | null;
  user: AuthUser | null;
  expiresAt: number | null; // epoch ms
}

// Action类型定义
interface AuthActions {
  login: (payload: LoginPayload) => void;
  logout: () => void;
  restore: () => void;
  isAuthenticated: () => boolean;
  refreshToken: (newToken: string, expiresIn: number) => void;
  updateUser: (userData: Partial<AuthUser>) => void;
  getToken: () => string | null;
  getTimeUntilExpiry: () => number; // 返回毫秒
  isTokenExpired: () => boolean;
  getState: () => AuthStore;
}

// 完整的Store类型
type AuthStore = AuthState & AuthActions;

const LS_TOKEN = 'auth.token';
const LS_USER = 'auth.user';
const LS_EXPIRES = 'auth.expiresAt';

// 安全的localStorage操作函数
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};

export const useAuthStore = create<AuthStore>((set: SetState<AuthStore>, get: GetState<AuthStore>): AuthStore => ({
  token: null,
  user: null,
  expiresAt: null,

  login: ({ token, user, expiresIn }: LoginPayload): void => {
    const expiresAt = Date.now() + expiresIn * 1000;

    // 安全地保存到localStorage
    safeLocalStorage.setItem(LS_TOKEN, token);
    safeLocalStorage.setItem(LS_USER, JSON.stringify(user));
    safeLocalStorage.setItem(LS_EXPIRES, String(expiresAt));

    // 更新用户最后登录时间
    const updatedUser = { ...user, lastLoginAt: new Date().toISOString() };

    set({ token, user: updatedUser, expiresAt });
  },

  logout: (): void => {
    // 安全地清除localStorage
    safeLocalStorage.removeItem(LS_TOKEN);
    safeLocalStorage.removeItem(LS_USER);
    safeLocalStorage.removeItem(LS_EXPIRES);

    set({ token: null, user: null, expiresAt: null });
  },

  restore: (): void => {
    const token = safeLocalStorage.getItem(LS_TOKEN);
    const userStr = safeLocalStorage.getItem(LS_USER);
    const expStr = safeLocalStorage.getItem(LS_EXPIRES);

    if (!token || !userStr || !expStr) {
      // 清理无效数据
      safeLocalStorage.removeItem(LS_TOKEN);
      safeLocalStorage.removeItem(LS_USER);
      safeLocalStorage.removeItem(LS_EXPIRES);
      set({ token: null, user: null, expiresAt: null });
      return;
    }

    const exp = Number(expStr);

    // 检查token是否过期
    if (isNaN(exp) || Date.now() > exp) {
      safeLocalStorage.removeItem(LS_TOKEN);
      safeLocalStorage.removeItem(LS_USER);
      safeLocalStorage.removeItem(LS_EXPIRES);
      set({ token: null, user: null, expiresAt: null });
      return;
    }

    try {
      const user = JSON.parse(userStr) as AuthUser;
      set({ token, user, expiresAt: exp });
    } catch {
      // JSON解析失败，清理数据
      safeLocalStorage.removeItem(LS_TOKEN);
      safeLocalStorage.removeItem(LS_USER);
      safeLocalStorage.removeItem(LS_EXPIRES);
      set({ token: null, user: null, expiresAt: null });
    }
  },

  isAuthenticated: (): boolean => {
    const { token, expiresAt } = get();
    return Boolean(token) && typeof expiresAt === 'number' && Date.now() <= expiresAt;
  },

  refreshToken: (newToken: string, expiresIn: number): void => {
    const expiresAt = Date.now() + expiresIn * 1000;

    safeLocalStorage.setItem(LS_TOKEN, newToken);
    safeLocalStorage.setItem(LS_EXPIRES, String(expiresAt));

    set({ token: newToken, expiresAt });
  },

  updateUser: (userData: Partial<AuthUser>): void => {
    const { user } = get();
    if (!user) {
return;
}

    const updatedUser = { ...user, ...userData };
    safeLocalStorage.setItem(LS_USER, JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  getToken: (): string | null => {
    const { token, expiresAt } = get();
    if (!token || !expiresAt) {
return null;
}
    return Date.now() <= expiresAt ? token : null;
  },

  getTimeUntilExpiry: (): number => {
    const { expiresAt } = get();
    if (!expiresAt) {
return 0;
}
    return Math.max(0, expiresAt - Date.now());
  },

  isTokenExpired: (): boolean => {
    const { expiresAt } = get();
    return !expiresAt || Date.now() > expiresAt;
  },

  getState: (): AuthStore => get(),
}));

export default useAuthStore;
