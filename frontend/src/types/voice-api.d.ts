/**
 * 语音和通话相关API类型定义
 *
 * 提供WebRTC、媒体流、语音识别等API的完整TypeScript类型支持
 */

// ============================================================================
// Web Speech API 类型定义
// ============================================================================

interface SpeechGrammarList {
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  length: number;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
  readonly message?: string;
  readonly error_code?: number;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;

  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ============================================================================
// 媒体设备API类型定义
// ============================================================================

interface MediaDevices {
  getDisplayMedia?(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  getSupportedConstraints(): MediaTrackSupportedConstraints;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  enumerateDevices(): Promise<MediaDeviceInfo[]>;
  setDeviceId?(deviceId: string): Promise<void>;

  ondevicechange: ((this: MediaDevices, ev: Event) => any) | null;
}

interface MediaStreamConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

interface MediaTrackConstraints {
  advanced?: MediaTrackConstraintSet[];
  aspectRatio?: number | ConstrainDoubleRange;
  autoGainControl?: boolean | ConstrainBooleanParameters;
  channelCount?: number | ConstrainULongRange;
  deviceId?: string | ConstrainDOMStringParameters;
  echoCancellation?: boolean | ConstrainBooleanParameters;
  facingMode?: string | ConstrainDOMStringParameters;
  frameRate?: number | ConstrainDoubleRange;
  groupId?: string | ConstrainDOMStringParameters;
  height?: number | ConstrainULongRange;
  latency?: number | ConstrainDoubleRange;
  noiseSuppression?: boolean | ConstrainBooleanParameters;
  resizeMode?: string | ConstrainDOMStringParameters;
  sampleRate?: number | ConstrainULongRange;
  sampleSize?: number | ConstrainULongRange;
  width?: number | ConstrainULongRange;
}

// ============================================================================
// Web Audio API类型定义
// ============================================================================

interface AudioContext {
  readonly currentTime: number;
  readonly destination: AudioDestinationNode;
  readonly listener: AudioListener;
  readonly sampleRate: number;
  readonly state: AudioContextState;
  readonly baseLatency: number;
  readonly outputLatency: number;
  readonly sinkId: string;

  createAnalyser(): AnalyserNode;
  createBiquadFilter(): BiquadFilterNode;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  createChannelMerger(numberOfInputs?: number): ChannelMergerNode;
  createChannelSplitter(numberOfOutputs?: number): ChannelSplitterNode;
  createConstantSource(): ConstantSourceNode;
  createConvolver(): ConvolverNode;
  createDelay(maxDelayTime?: number): DelayNode;
  createDynamicsCompressor(): DynamicsCompressorNode;
  createGain(): GainNode;
  createIIRFilter(feedforward: number[], feedback: number[]): IIRFilterNode;
  createOscillator(): OscillatorNode;
  createPanner(): PannerNode;
  createPeriodicWave(real: number[], imag: number[], constraints?: PeriodicWaveConstraints): PeriodicWave;
  createScriptProcessor(bufferSize?: number, numberOfInputChannels?: number, numberOfOutputChannels?: number): ScriptProcessorNode;
  createStereoPanner(): StereoPannerNode;
  createWaveShaper(): WaveShaperNode;

  createMediaElementSource(mediaElement: HTMLMediaElement): MediaElementAudioSourceNode;
  createMediaStreamSource(mediaStream: MediaStream): MediaStreamAudioSourceNode;
  createMediaStreamTrackSource(mediaStreamTrack: MediaStreamTrack): MediaStreamAudioSourceNode;
  createMediaStreamDestination(): MediaStreamAudioDestinationNode;

  decodeAudioData(audioData: ArrayBuffer, successCallback?: DecodeSuccessCallback, errorCallback?: DecodeErrorCallback): Promise<AudioBuffer>;

  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;

  getOutputTimestamp(): AudioTimestamp;
  setSinkId(sinkId: string): Promise<void>;

  onstatechange: ((this: AudioContext, ev: Event) => any) | null;
}

interface AudioContextConstructor {
  new (contextId?: string, sinkId?: string): AudioContext;
}

declare global {
  interface Window {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  }
}

// ============================================================================
// 语音合成API类型定义
// ============================================================================

interface SpeechSynthesis {
  readonly pending: boolean;
  readonly speaking: boolean;
  readonly paused: boolean;

  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
  pause(): void;
  resume(): void;
  speak(utterance: SpeechSynthesisUtterance): void;

  onvoiceschanged: ((this: SpeechSynthesis, ev: Event) => any) | null;
}

interface SpeechSynthesisUtterance extends EventTarget {
  lang: string;
  pitch: number;
  rate: number;
  text: string;
  voice: SpeechSynthesisVoice | null;
  volume: number;

  onboundary: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => any) | null;
  onmark: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
}

interface SpeechSynthesisUtteranceConstructor {
  new (text?: string): SpeechSynthesisUtterance;
}

declare global {
  interface Window {
    SpeechSynthesisUtterance: SpeechSynthesisUtteranceConstructor;
  }
}

// ============================================================================
// 实用工具类型
// ============================================================================

/**
 * 检查浏览器是否支持语音识别
 */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
         !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * 获取语音识别构造函数
 */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * 检查浏览器是否支持音频采集
 */
export function isAudioCaptureSupported(): boolean {
  return typeof navigator !== 'undefined' &&
         navigator.mediaDevices &&
         typeof navigator.mediaDevices.getUserMedia === 'function';
}

/**
 * 检查浏览器是否支持语音合成
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' &&
         'speechSynthesis' in window &&
         'SpeechSynthesisUtterance' in window;
}

/**
 * 获取音频上下文构造函数
 */
export function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.AudioContext || window.webkitAudioContext || null;
}

// ============================================================================
// 缺失的类型定义
// ============================================================================

interface AudioTimestamp {
  contextTime: number;
  performanceTime: number;
}

interface DecodeSuccessCallback {
  (decodedData: AudioBuffer): void;
}

interface DecodeErrorCallback {
  (error: DOMException): void;
}

type AudioContextState = 'suspended' | 'running' | 'closed';

type PeriodicWaveConstraints = {
  disableNormalization: boolean;
};

// ============================================================================
// 导出类型
// ============================================================================

export type {
  SpeechRecognition,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent,
  SpeechRecognitionConstructor,
  SpeechGrammarList,
  SpeechGrammar,
  MediaDevices,
  MediaStreamConstraints,
  MediaTrackConstraints,
  AudioContext,
  AudioContextConstructor,
  AudioTimestamp,
  AudioContextState,
  SpeechSynthesis,
  SpeechSynthesisUtterance,
  SpeechSynthesisUtteranceConstructor,
  DecodeSuccessCallback,
  DecodeErrorCallback,
  PeriodicWaveConstraints,
};