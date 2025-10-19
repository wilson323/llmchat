/**
 * Web Speech API类型定义
 * 为语音识别和音频上下文提供TypeScript类型支持
 */

// ========================================
// Speech Recognition Types
// ========================================

export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  // 事件处理器
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

  // 方法
  abort(): void;
  start(): void;
  stop(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}

// ========================================
// Browser Compatibility Helpers
// ========================================

/**
 * 获取浏览器支持的SpeechRecognition构造函数
 * 支持标准和WebKit前缀版本
 */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // @ts-ignore - WebKit前缀
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SpeechRecognitionAPI || null;
}

/**
 * 获取浏览器支持的AudioContext构造函数
 * 支持标准和WebKit前缀版本
 */
export function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // @ts-ignore - WebKit前缀
  const AudioContextAPI = window.AudioContext || window.webkitAudioContext;
  return AudioContextAPI || null;
}

// ========================================
// Feature Detection
// ========================================

/**
 * 检测浏览器是否支持Web Speech API
 */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/**
 * 检测浏览器是否支持Web Audio API
 */
export function isWebAudioSupported(): boolean {
  return getAudioContextConstructor() !== null;
}

/**
 * 检测浏览器是否支持语音功能的所有必需API
 */
export function isVoiceApiSupported(): boolean {
  return isSpeechRecognitionSupported() && isWebAudioSupported();
}

// ========================================
// Type Guards
// ========================================

export function isSpeechRecognitionEvent(event: Event): event is SpeechRecognitionEvent {
  return 'results' in event && 'resultIndex' in event;
}

export function isSpeechRecognitionErrorEvent(
  event: Event,
): event is SpeechRecognitionErrorEvent {
  return 'error' in event && 'message' in event;
}

