/**
 * 统一的 API 响应类型定义
 * 
 * 所有后端 API 都返回统一的响应格式：
 * {
 *   code: string;      // 业务状态码，如 'SUCCESS', 'ERROR'
 *   message: string;   // 响应消息
 *   data: T;           // 业务数据
 *   timestamp: string; // 时间戳
 * }
 */

/**
 * 统一的 API 响应格式
 * @template T 业务数据类型
 */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * API 错误响应格式
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  data: null;
  timestamp: string;
  error?: {
    details?: string;
    stack?: string;
  };
}

/**
 * 分页响应数据格式
 * @template T 列表项类型
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 批量操作响应格式
 */
export interface BatchOperationResult {
  success: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * 从 Axios 响应中提取业务数据的辅助函数
 * 
 * @example
 * ```typescript
 * const response = await api.get<ApiResponse<User>>('/user/profile');
 * const user = extractData(response); // 类型为 User
 * ```
 */
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data;
}

/**
 * 从 Axios 响应中提取分页数据的辅助函数
 */
export function extractPaginatedData<T>(
  response: { data: ApiResponse<PaginatedData<T>> }
): PaginatedData<T> {
  return response.data.data;
}
