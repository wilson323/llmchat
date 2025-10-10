import { api } from './api';

export interface LoginResponse {
  token: string;
  user: { id: string; username: string; role?: string };
  expiresIn: number;
}

export async function loginApi(username: string, password: string) {
  const response = await api.post<{ code: string; message: string; data: LoginResponse }>('/auth/login', { username, password });
  return response.data.data; // 提取嵌套的 data 字段
}

export async function profileApi() {
  const response = await api.get<{ code: string; message: string; data: { user: { id: string; username: string; role?: string } } }>(
    '/auth/profile',
  );
  return response.data.data.user; // 提取嵌套的 data.user
}

export async function logoutApi() {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // ignore
  }
}

export async function changePasswordApi(oldPassword: string, newPassword: string) {
  const response = await api.post<{ code: string; message: string; data: { success: boolean } }>('/auth/change-password', { oldPassword, newPassword });
  return response.data.data; // 提取嵌套的 data 字段
}
