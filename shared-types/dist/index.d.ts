/**
 * LLMChat 前后端共享类型定义
 *
 * 统一管理所有跨模块使用的类型，避免重复定义和同步问题
 */
/**
 * JSON数组类型
 */
export type JsonArray = JsonValue[];
/**
 * JSON值类型
 */
export type JsonValue = string | number | boolean | null | JsonArray | {
    readonly [key: string]: JsonValue;
};
/**
 * 通用的键值对对象类型
 */
export interface JsonObject {
    readonly [key: string]: JsonValue;
}
/**
 * 安全的未知类型，用于替换any
 */
export type UnknownValue = string | number | boolean | null | undefined | JsonObject | JsonArray | Function | Symbol | bigint;
/**
 * 通用数据载荷接口
 */
export interface DataPayload<T extends JsonValue = JsonValue> {
    data: T;
    type?: string;
    timestamp?: string;
    metadata?: JsonObject;
}
/**
 * 通用API请求载荷
 */
export interface ApiRequestPayload {
    [key: string]: UnknownValue;
}
/**
 * 通用API响应载荷
 */
export interface ApiResponsePayload {
    success: boolean;
    data?: JsonValue;
    error?: {
        code: string;
        message: string;
        details?: JsonObject;
    };
    metadata?: {
        requestId?: string;
        timestamp?: string;
        version?: string;
    };
}
/**
 * 外部服务通用响应
 */
export interface ExternalServiceResponse {
    status: number;
    statusText: string;
    data: JsonValue;
    headers: Record<string, string>;
    config: {
        url: string;
        method: string;
        timeout?: number;
    };
}
/**
 * FastGPT事件载荷基础接口
 */
export interface FastGPTEventPayload {
    id?: string;
    event?: string;
    data: JsonValue;
    timestamp?: string;
    source?: string;
    appId?: string;
    chatId?: string;
    flowId?: string;
    nodeId?: string;
}
/**
 * FastGPT推理数据结构
 */
export interface FastGPTReasoningData {
    text?: string;
    content?: string;
    message?: string;
    analysis?: string;
    reasoning?: string;
    reasoning_content?: JsonValue;
    details?: string;
    title?: string;
    order?: number;
    step?: number;
    stepIndex?: number;
    stepNumber?: number;
    index?: number;
    thoughtNumber?: number;
    totalThoughts?: number;
    totalSteps?: number;
    total_steps?: number;
    nextThoughtNeeded?: boolean;
    need_next_thought?: boolean;
    hasMore?: boolean;
    has_more?: boolean;
    finished?: boolean;
    is_final?: boolean;
    isFinal?: boolean;
    done?: boolean;
    completed?: boolean;
    output?: {
        reasoning_content?: JsonValue;
    };
    delta?: {
        reasoning_content?: JsonValue;
    };
    steps?: JsonValue;
    data?: JsonValue;
    payload?: JsonValue;
    raw?: JsonValue;
    thought?: JsonValue;
}
/**
 * 推理步骤更新
 */
export interface ReasoningStepUpdate {
    content: string;
    order?: number;
    totalSteps?: number;
    title?: string;
    raw?: JsonValue;
    timestamp?: string;
}
/**
 * 解析后的推理更新
 */
export interface ParsedReasoningUpdate {
    steps: ReasoningStepUpdate[];
    finished?: boolean;
    totalSteps?: number;
}
/**
 * FastGPT流式事件类型
 */
export type FastGPTStreamEventType = 'status' | 'interactive' | 'flowNodeStatus' | 'progress' | 'error' | 'complete' | 'start' | 'end' | 'workflowDuration' | 'reasoning' | 'step' | 'chunk';
/**
 * FastGPT事件元数据
 */
export interface FastGPTEventMetadata {
    label: string;
    level: 'info' | 'success' | 'warning' | 'error';
    summary?: (payload: JsonValue) => string | undefined;
}
/**
 * FastGPT标准化事件
 */
export interface FastGPTEvent {
    type: FastGPTStreamEventType;
    label: string;
    level: 'info' | 'success' | 'warning' | 'error';
    summary?: string;
    payload?: JsonValue;
    timestamp: string;
    raw?: JsonValue;
}
/**
 * 动态数据类型守卫
 */
export declare class DynamicTypeGuard {
    /**
     * 检查是否为有效的JSON值
     */
    static isJsonValue(value: unknown): value is JsonValue;
    /**
     * 检查是否为有效的API请求载荷
     */
    static isApiRequestPayload(value: unknown): value is ApiRequestPayload;
    /**
     * 检查是否为有效的FastGPT事件载荷
     */
    static isFastGPTEventPayload(value: unknown): value is FastGPTEventPayload;
    /**
     * 检查是否为有效的推理数据
     */
    static isReasoningData(value: unknown): value is FastGPTReasoningData;
}
/**
 * 动态数据转换器
 */
export declare class DynamicDataConverter {
    /**
     * 安全转换为JSON值
     */
    static toJsonValue(value: unknown, defaultValue?: JsonValue): JsonValue;
    /**
     * 安全转换复杂对象为JSON值
     */
    static toSafeJsonValue(obj: unknown): JsonValue;
}
/**
 * 安全的属性访问工具
 */
export declare class SafeAccess {
    /**
     * 安全地从 JsonValue 中获取属性
     */
    static getProperty<T extends JsonValue>(obj: JsonValue | undefined, key: string, guard: (value: JsonValue) => value is T, defaultValue: T): T;
    /**
     * 安全地从 JsonValue 中获取字符串属性
     */
    static getString(obj: JsonValue | undefined, key: string, defaultValue?: string): string;
    /**
     * 安全地从 JsonValue 中获取数字属性
     */
    static getNumber(obj: JsonValue | undefined, key: string, defaultValue?: number): number;
    /**
     * 安全地从 JsonValue 中获取布尔属性
     */
    static getBoolean(obj: JsonValue | undefined, key: string, defaultValue?: boolean): boolean;
    /**
     * 安全地从 JsonValue 中获取对象属性
     */
    static getObject(obj: JsonValue | undefined, key: string): JsonValue | undefined;
}
/**
 * 分页查询参数
 */
export interface PaginationParams {
    page?: number;
    pageSize?: number;
    offset?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
/**
 * 时间范围查询参数
 */
export interface DateRangeParams {
    startDate?: string;
    endDate?: string;
}
/**
 * 搜索过滤参数
 */
export interface SearchFilterParams {
    search?: string;
    filters?: JsonObject;
    tags?: string[];
}
/**
 * 组合查询参数
 */
export interface QueryParams extends PaginationParams, DateRangeParams, SearchFilterParams {
    [key: string]: UnknownValue;
}
