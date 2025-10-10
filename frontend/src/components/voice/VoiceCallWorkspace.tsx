import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Loader2,
  Mic,
  Phone,
  PhoneOff,
  User,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { Agent } from '@/types';
import { Button } from '@/components/ui/Button';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import avatarImg from '@/img/4.png';

type CallStatus = 'idle' | 'connecting' | 'in-call' | 'ended';

interface BrowserSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onaudioend: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  onend: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: BrowserSpeechRecognition, ev: any) => any) | null;
  onresult: ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionEvent) => any) | null;
  onstart: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

interface CallStatusMeta {
  label: string;
  helper: string;
  tone: string;
  icon: LucideIcon;
  iconTone: string;
  helperTone: string;
}

const CALL_STATUS_META: Record<CallStatus, CallStatusMeta> = {
  idle: {
    label: '等待开始',
    helper: '准备好后点击“开始通话”，系统将开启语音监听。',
    tone: 'border-white/20 bg-white/5 text-muted-foreground',
    icon: Phone,
    iconTone: 'text-muted-foreground',
    helperTone: 'text-muted-foreground',
  },
  connecting: {
    label: '正在连接…',
    helper: '请稍候，正在建立语音链路并初始化识别。',
    tone: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
    icon: Loader2,
    iconTone: 'text-amber-300 animate-spin',
    helperTone: 'text-amber-200',
  },
  'in-call': {
    label: '通话中',
    helper: '助手会实时倾听与响应，可随时结束或继续对话。',
    tone: 'border-brand/40 bg-brand/10 text-brand',
    icon: Phone,
    iconTone: 'text-brand voice-breathe',
    helperTone: 'text-brand',
  },
  ended: {
    label: '通话已结束',
    helper: '可以回顾上方记录，或重新发起新的语音通话。',
    tone: 'border-white/15 bg-white/5 text-muted-foreground',
    icon: PhoneOff,
    iconTone: 'text-muted-foreground',
    helperTone: 'text-muted-foreground',
  },
};

interface VoiceCallWorkspaceProps {
  agent: Agent;
}

export const VoiceCallWorkspace: React.FC<VoiceCallWorkspaceProps> = ({ agent }) => {
  const {
    messages,
    isStreaming,
    streamingStatus,
    clearMessages,
    createNewSession,
    currentAgent,
    currentSession,
    updateSession,
    renameSession,
  } = useChatStore();
  const { sendMessage } = useChat();

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [listening, setListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastUtterance, setLastUtterance] = useState('');
  const [recognitionSupported, setRecognitionSupported] = useState(true);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number>();
  const callStatusRef = useRef<CallStatus>('idle');
  const spokenMessageRef = useRef<Set<string>>(new Set());
  const callStartRef = useRef<number | null>(null);
  const finalUtterancesRef = useRef<string[]>([]);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const conversationMessages = useMemo(
    () =>
      messages.filter(
        (message) => typeof message.HUMAN === 'string' || typeof message.AI === 'string',
      ),
    [messages],
  );

  const agentAvatar = agent.avatar && agent.avatar.trim().length > 0 ? agent.avatar : avatarImg;
  const statusMeta = CALL_STATUS_META[callStatus];
  const StatusIcon = statusMeta.icon;

  useEffect(() => {
    setRecognitionSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    if (callStatus !== 'in-call') {
      callStartRef.current = null;
      setCallDuration(0);
      return;
    }

    callStartRef.current = Date.now();
    const interval = window.setInterval(() => {
      if (callStartRef.current) {
        setCallDuration(Date.now() - callStartRef.current);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [callStatus]);

  useEffect(() => {
    if (!conversationRef.current) {
      return;
    }
    conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [conversationMessages.length, interimTranscript]);

  const registerFinalUtterance = useCallback((utterance: string) => {
    const text = utterance.trim();
    if (!text) {
      return false;
    }
    if (finalUtterancesRef.current.includes(text)) {
      return false;
    }

    finalUtterancesRef.current = [...finalUtterancesRef.current.slice(-4), text];
    return true;
  }, []);

  const speakAssistantMessage = useCallback((text: string) => {
    if (!text || !window?.speechSynthesis) {
      return;
    }
    try {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('语音播报失败', err);
    }
  }, []);

  useEffect(() => {
    if (callStatus !== 'in-call') {
      return;
    }
    if (conversationMessages.length === 0) {
      return;
    }

    const assistantMessages = conversationMessages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => typeof message.AI === 'string' && message.AI.trim().length > 0);

    if (assistantMessages.length === 0) {
      return;
    }

    const latest = assistantMessages[assistantMessages.length - 1];
    const key = latest.message.id || `assistant-${latest.index}`;

    if (spokenMessageRef.current.has(key)) {
      return;
    }
    if (isStreaming) {
      return;
    }
    if (streamingStatus?.type && streamingStatus.type !== 'complete') {
      return;
    }

    spokenMessageRef.current.add(key);
    speakAssistantMessage(latest.message.AI as string);
  }, [conversationMessages, callStatus, isStreaming, streamingStatus, speakAssistantMessage]);

  const cleanupAudio = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }

    setListening(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setVolume(0);
    setInterimTranscript('');
  }, []);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  const handleSendRecognizedText = useCallback(
    async (rawText: string) => {
      const content = rawText.trim();
      if (!content) {
        return;
      }

      try {
        await sendMessage(content, { detail: true });
        setLastUtterance(content);

        const store = useChatStore.getState();
        const activeSession = store.currentSession;
        if (activeSession && activeSession.agentId === agent.id) {
          const metadata = activeSession.metadata || {};
          if (metadata.type === 'voice-call' && !metadata.firstUtterance) {
            const summary = content.length > 30 ? `${content.slice(0, 30)}...` : content;
            if (summary) {
              renameSession(activeSession.id, summary);
            }
            updateSession(agent.id, activeSession.id, (session) => ({
              ...session,
              metadata: {
                ...(session.metadata || {}),
                type: 'voice-call',
                firstUtterance: content,
              },
              updatedAt: new Date(),
            }));
          }
        }
      } catch (err) {
        console.error('发送语音消息失败', err);
        setError('发送语音消息失败，请稍后重试。');
      }
    },
    [agent.id, renameSession, sendMessage, updateSession],
  );

  const handleStartCall = useCallback(async () => {
    if (callStatus === 'connecting' || callStatus === 'in-call') {
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持音频采集，请更换更现代的浏览器。');
      return;
    }

    setError(null);
    setInterimTranscript('');
    setLastUtterance('');
    spokenMessageRef.current.clear();
    finalUtterancesRef.current = [];
    setCallStatus('connecting');
    callStatusRef.current = 'connecting';

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext: AudioContext = new AudioContextCtor();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
          if (!analyserRef.current) {
            return;
          }
          analyserRef.current.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            const value = (dataArray[i] - 128) / 128;
            sumSquares += value * value;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          setVolume(Math.min(1, rms * 4));
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };

        updateVolume();
      }

      const RecognitionCtor = getSpeechRecognition();
      if (!RecognitionCtor) {
        setRecognitionSupported(false);
        setError('当前浏览器暂不支持实时语音识别，建议使用最新版 Chrome。');
      } else {
        const recognition: BrowserSpeechRecognition = new RecognitionCtor();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setListening(true);
        recognition.onend = () => {
          setListening(false);
          if (callStatusRef.current === 'in-call') {
            try {
              recognition.start();
            } catch (err) {
              console.warn('语音识别重启失败', err);
            }
          }
        };
        recognition.onerror = (event: any) => {
          if (event?.error === 'aborted' || event?.error === 'no-speech') {
            return;
          }
          setError(`语音识别出错：${event?.error ?? '未知错误'}`);
        };
        recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) {
              continue;
            }
            const transcript = result[0]?.transcript?.trim();
            if (!transcript) {
              continue;
            }

            if (result.isFinal) {
              if (registerFinalUtterance(transcript)) {
                void handleSendRecognizedText(transcript);
              }
            } else {
              interim = `${interim} ${transcript}`.trim();
            }
          }
          setInterimTranscript(interim);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      clearMessages();
      createNewSession();

      const createdSession = useChatStore.getState().currentSession;
      const startedAt = new Date();
      if (createdSession && createdSession.agentId === agent.id) {
        renameSession(
          createdSession.id,
          `语音通话 ${startedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
        );
        updateSession(agent.id, createdSession.id, (session) => ({
          ...session,
          metadata: {
            ...(session.metadata || {}),
            type: 'voice-call',
            startedAt: startedAt.toISOString(),
          },
          updatedAt: startedAt,
        }));
      }

      setCallStatus('in-call');
      callStatusRef.current = 'in-call';
    } catch (err) {
      console.error('初始化语音通话失败', err);
      setError(err instanceof Error ? err.message : '无法启动语音通话，请检查设备权限。');
      cleanupAudio();
      setCallStatus('idle');
      callStatusRef.current = 'idle';
    }
  }, [
    agent.id,
    callStatus,
    clearMessages,
    createNewSession,
    cleanupAudio,
    handleSendRecognizedText,
    registerFinalUtterance,
    renameSession,
    updateSession,
  ]);

  const handleStopCall = useCallback(() => {
    if (callStatus === 'idle') {
      return;
    }
    setCallStatus('ended');
    callStatusRef.current = 'ended';
    const endedAt = new Date();
    const durationMs = callStartRef.current ? Date.now() - callStartRef.current : callDuration;
    if (currentAgent?.id === agent.id && currentSession) {
      updateSession(agent.id, currentSession.id, (session) => ({
        ...session,
        metadata: {
          ...(session.metadata || {}),
          type: 'voice-call',
          startedAt: session.metadata?.startedAt || (callStartRef.current ? new Date(callStartRef.current).toISOString() : undefined),
          endedAt: endedAt.toISOString(),
          durationMs,
          lastUtterance,
          finalUtterances: [...finalUtterancesRef.current],
        },
        updatedAt: endedAt,
      }));
    }
    cleanupAudio();
  }, [
    agent.id,
    callDuration,
    callStatus,
    cleanupAudio,
    currentAgent?.id,
    currentSession,
    lastUtterance,
    updateSession,
  ]);

  const volumePercent = Math.round(Math.min(1, volume) * 100);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="relative rounded-3xl border border-white/15 bg-gradient-to-br from-brand/15 via-background/80 to-background/60 p-6 shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* 背景装饰：4.png 图片 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -right-20 -top-20 h-64 w-64 opacity-10 voice-float">
            <img
              src={avatarImg}
              alt=""
              className="h-full w-full object-contain filter blur-sm"
              aria-hidden
            />
          </div>
          {callStatus === 'in-call' && (
            <>
              <div className="absolute left-10 top-10 h-32 w-32 opacity-5 voice-breathe">
                <img
                  src={avatarImg}
                  alt=""
                  className="h-full w-full object-contain"
                  aria-hidden
                />
              </div>
              <div className="absolute right-10 bottom-10 h-40 w-40 opacity-5 voice-float voice-delay-1000">
                <img
                  src={avatarImg}
                  alt=""
                  className="h-full w-full object-contain"
                  aria-hidden
                />
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* 左侧：智能体信息 + 头像 */}
          <div className="flex items-center gap-6">
            {/* 头像区域 - 添加呼吸灯效果 */}
            <div className="relative">
              <div className={cn(
                'h-24 w-24 overflow-hidden rounded-full border-4 transition-all duration-300',
                callStatus === 'in-call'
                  ? 'border-brand shadow-xl shadow-brand/50 voice-breathe'
                  : 'border-white/20',
              )}>
                <img
                  src={agentAvatar}
                  alt={agent.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* 脉冲圆环 - 仅在通话中显示 */}
              {callStatus === 'in-call' && (
                <>
                  <div className="voice-pulse absolute inset-0 rounded-full border-4 border-brand" />
                  <div className="voice-pulse voice-delay-1000 absolute inset-0 rounded-full border-4 border-brand" />
                </>
              )}
              {/* 状态指示点 */}
              <div className={cn(
                'absolute bottom-2 right-2 h-5 w-5 rounded-full border-2 border-white',
                callStatus === 'in-call'
                  ? 'bg-green-500 voice-breathe'
                  : callStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-400',
              )}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-brand/80">实时语音通话</p>
              <h2 className="text-2xl font-semibold text-foreground">{agent.name}</h2>
              <p className="max-w-xl text-sm text-muted-foreground">{agent.description}</p>
            </div>
          </div>

          {/* 右侧：状态和按钮 */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-3 text-right">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-inner transition-colors',
                  statusMeta.tone,
                )}
              >
                <StatusIcon className={cn('h-4 w-4', statusMeta.iconTone)} />
                <span>{statusMeta.label}</span>
              </div>
              <p
                className={cn(
                  'max-w-[240px] text-xs leading-snug',
                  statusMeta.helperTone,
                )}
              >
                {statusMeta.helper}
              </p>
              {callStatus === 'in-call' && (
                <span className="font-mono text-lg font-semibold text-brand voice-breathe">
                  {formatDuration(callDuration)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleStartCall}
                disabled={callStatus === 'connecting' || callStatus === 'in-call'}
                variant="brand"
                size="lg"
                radius="lg"
                className="gap-2 shadow-lg"
              >
                {callStatus === 'connecting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                {callStatus === 'in-call' ? '通话中' : '开始通话'}
              </Button>
              <Button
                onClick={handleStopCall}
                disabled={callStatus === 'idle' || callStatus === 'ended'}
                variant="outline"
                size="lg"
                radius="lg"
                className={cn(
                  'gap-2 border-destructive/40 text-destructive hover:bg-destructive/10',
                  callStatus === 'idle' || callStatus === 'ended' ? 'opacity-50' : '',
                )}
              >
                <PhoneOff className="h-4 w-4" />
                结束通话
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 sm:grid-cols-2 backdrop-blur-sm">
          {/* 麦克风状态卡片 */}
          <div className="flex items-center gap-3 transition-all duration-300 hover:bg-white/5 rounded-xl p-2">
            <div className={cn(
              'relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300',
              listening ? 'bg-brand/40 shadow-lg shadow-brand/30' : 'bg-brand/20',
            )}>
              {listening && (
                <div className="voice-pulse absolute inset-0 rounded-2xl border-2 border-brand opacity-75" />
              )}
              <Mic className={cn(
                'h-6 w-6 transition-all duration-300',
                listening ? 'text-white scale-110' : 'text-brand',
              )} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">麦克风状态</p>
              <p className={cn(
                'text-xs transition-colors duration-300',
                listening ? 'text-brand font-medium' : 'text-muted-foreground',
              )}>
                {listening ? '🎤 正在倾听，请开始讲话…' : '待命中，点击开始通话后开始识别'}
              </p>
            </div>
          </div>

          {/* 音量监测卡片 */}
          <div className="flex items-center gap-3 transition-all duration-300 hover:bg-white/5 rounded-xl p-2">
            <div className={cn(
              'relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300',
              volume > 0.3 ? 'bg-brand/40 shadow-lg shadow-brand/30' : 'bg-brand/20',
            )}>
              {volume > 0.5 && (
                <div className="voice-pulse voice-delay-500 absolute inset-0 rounded-2xl border-2 border-brand opacity-75" />
              )}
              <Volume2 className={cn(
                'h-6 w-6 transition-all duration-150',
                volume > 0.3 ? 'text-white' : 'text-brand',
                volume > 0.5 ? 'scale-125' : volume > 0.3 ? 'scale-110' : 'scale-100',
              )} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">音量监测</p>
              <div className="mt-2 h-3 rounded-full bg-white/10 overflow-hidden relative">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-150',
                    volumePercent > 70 ? 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500' :
                    volumePercent > 40 ? 'bg-gradient-to-r from-brand via-brand/80 to-brand/60' :
                    'bg-gradient-to-r from-brand/60 to-brand/40',
                  )}
                  style={{ width: `${volumePercent}%` }}
                />
                {/* 动态音量指示器 */}
                {volume > 0.1 && (
                  <div
                    className="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-150"
                    style={{ left: `${volumePercent}%` }}
                  />
                )}
              </div>
              <p className={cn(
                'mt-1 text-xs transition-colors duration-300 font-mono',
                volumePercent > 70 ? 'text-red-400 font-semibold' :
                volumePercent > 40 ? 'text-brand' :
                'text-muted-foreground',
              )}>
                当前输入电平：{volumePercent}%
                {volumePercent > 70 && ' ⚠️'}
              </p>
            </div>
          </div>
        </div>

        {interimTranscript && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-brand">语音识别中：</span> {interimTranscript}
          </div>
        )}

        {lastUtterance && callStatus === 'in-call' && (
          <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm text-brand">
            <span className="font-medium">上次识别结果：</span> {lastUtterance}
          </div>
        )}

        {!recognitionSupported && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-100/20 p-4 text-sm text-amber-500">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            当前浏览器暂不支持 Web Speech API，语音识别功能可能不可用。建议在桌面端 Chrome 浏览器中体验完整语音能力。
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden rounded-3xl border border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">通话记录</h3>
            <p className="text-xs text-muted-foreground">语音识别文本与助手回复将实时呈现，贴近电话对话体验。</p>
          </div>
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-brand">
              <Loader2 className="h-4 w-4 animate-spin" />
              助手正在组织回答…
            </div>
          )}
        </div>

        <div ref={conversationRef} className="h-full space-y-4 overflow-y-auto px-6 py-6">
          {conversationMessages.length === 0 && !interimTranscript ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <Mic className="h-6 w-6 text-brand" />
              点击“开始通话”后即可开口说话，助手会实时识别语音并以语音回复。
            </div>
          ) : (
            <>
              {conversationMessages.map((message, index) => {
                const isUser = typeof message.HUMAN === 'string';
                const key = message.id || `${isUser ? 'user' : 'assistant'}-${index}`;
                const content = isUser ? message.HUMAN : message.AI;
                if (!content) {
return null;
}

                return (
                  <div
                    key={key}
                    className={cn(
                      'flex gap-3',
                      isUser ? 'flex-row-reverse text-right' : 'flex-row text-left',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full shadow-inner',
                        isUser ? 'bg-brand text-white' : 'bg-white/10 text-brand',
                      )}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg',
                        isUser
                          ? 'bg-brand text-brand-foreground rounded-tr-sm'
                          : 'bg-white/5 text-foreground rounded-tl-sm',
                      )}
                    >
                      {content}
                    </div>
                  </div>
                );
              })}

              {interimTranscript && (
                <div className="flex justify-end">
                  <div className="rounded-2xl bg-brand/10 px-4 py-2 text-xs text-brand">
                    正在识别：{interimTranscript}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
