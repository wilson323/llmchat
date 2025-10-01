"use strict";
/**
 * LLMChat 前后端共享类型定义
 *
 * 统一管理所有跨模块使用的类型，避免重复定义和同步问题
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeAccess = exports.DynamicDataConverter = exports.DynamicTypeGuard = void 0;
// ============================================================================
// 类型守卫和验证器
// ============================================================================
/**
 * 动态数据类型守卫
 */
class DynamicTypeGuard {
    /**
     * 检查是否为有效的JSON值
     */
    static isJsonValue(value) {
        const isPrimitive = (v) => {
            return typeof v === 'string' ||
                typeof v === 'number' ||
                typeof v === 'boolean' ||
                v === null;
        };
        const isArray = (v) => {
            return Array.isArray(v) && v.every((item) => DynamicTypeGuard.isJsonValue(item));
        };
        const isObject = (v) => {
            return typeof v === 'object' &&
                v !== null &&
                !Array.isArray(v) &&
                Object.entries(v).every(([_, val]) => DynamicTypeGuard.isJsonValue(val));
        };
        return isPrimitive(value) || isArray(value) || isObject(value);
    }
    /**
     * 检查是否为有效的API请求载荷
     */
    static isApiRequestPayload(value) {
        return typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value);
    }
    /**
     * 检查是否为有效的FastGPT事件载荷
     */
    static isFastGPTEventPayload(value) {
        if (!this.isApiRequestPayload(value))
            return false;
        const payload = value;
        return this.isJsonValue(payload.data);
    }
    /**
     * 检查是否为有效的推理数据
     */
    static isReasoningData(value) {
        return this.isApiRequestPayload(value);
    }
}
exports.DynamicTypeGuard = DynamicTypeGuard;
/**
 * 动态数据转换器
 */
class DynamicDataConverter {
    /**
     * 安全转换为JSON值
     */
    static toJsonValue(value, defaultValue = null) {
        if (DynamicTypeGuard.isJsonValue(value))
            return value;
        // 尝试转换常见类型
        if (typeof value === 'bigint')
            return value.toString();
        if (typeof value === 'function')
            return value.toString();
        if (typeof value === 'symbol')
            return value.toString();
        if (value === undefined)
            return null;
        return defaultValue;
    }
    /**
     * 安全转换复杂对象为JSON值
     */
    static toSafeJsonValue(obj) {
        if (obj === null || obj === undefined)
            return null;
        // 基本类型
        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
            return obj;
        }
        // 数组
        if (Array.isArray(obj)) {
            return obj.map(item => this.toSafeJsonValue(item));
        }
        // 对象
        if (typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.toSafeJsonValue(value);
            }
            return result;
        }
        // 其他类型转换为字符串
        return String(obj);
    }
}
exports.DynamicDataConverter = DynamicDataConverter;
// ============================================================================
// 工具函数
// ============================================================================
/**
 * 安全的属性访问工具
 */
class SafeAccess {
    /**
     * 安全地从 JsonValue 中获取属性
     */
    static getProperty(obj, key, guard, defaultValue) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return defaultValue;
        }
        const value = obj[key];
        if (value !== undefined && guard(value)) {
            return value;
        }
        return defaultValue;
    }
    /**
     * 安全地从 JsonValue 中获取字符串属性
     */
    static getString(obj, key, defaultValue = '') {
        return this.getProperty(obj, key, (value) => typeof value === 'string', defaultValue);
    }
    /**
     * 安全地从 JsonValue 中获取数字属性
     */
    static getNumber(obj, key, defaultValue = 0) {
        return this.getProperty(obj, key, (value) => typeof value === 'number' && !isNaN(value), defaultValue);
    }
    /**
     * 安全地从 JsonValue 中获取布尔属性
     */
    static getBoolean(obj, key, defaultValue = false) {
        return this.getProperty(obj, key, (value) => typeof value === 'boolean', defaultValue);
    }
    /**
     * 安全地从 JsonValue 中获取对象属性
     */
    static getObject(obj, key) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return undefined;
        }
        const value = obj[key];
        if (value !== undefined &&
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)) {
            return value;
        }
        return undefined;
    }
}
exports.SafeAccess = SafeAccess;
