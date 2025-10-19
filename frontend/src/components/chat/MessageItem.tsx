
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp, User } from 'lucide-react';
import React, { useState, memo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { ChatMessage, Agent, StreamStatus, InteractiveSelectParams, InteractiveInputParams, InteractiveFormItem } from '@/types';
import 'highlight.js/styles/github-dark.css';
import { useChatStore } from '@/store/chatStore';
import { chatService } from '@/services/api';
import { ReasoningTrail } from './ReasoningTrail';
import { EventTrail } from './EventTrail';
import { useA11yAnnouncer } from '@/hooks/useA11yAnnouncer';
import { useI18n } from '@/i18n';

// 回调函数类型定义
interface InteractiveCallbacks {
  onInteractiveSelect?: (value: string | { origin: 'init'; key?: string; value: string }) => void;
  onInteractiveFormSubmit?: (values: Record<string, unknown> | { origin: 'init'; values: Record<string, unknown> }) => void;
}

// ReactMarkdown code组件props类型
interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  className?: string | undefined;
  children?: React.ReactNode;
}

const avatarImg = '/img/4.webp';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface MessageItemProps extends InteractiveCallbacks {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: (() => void) | undefined;
  onEdit?: ((content: string) => void) | undefined;
  onDelete?: (() => void) | undefined;
  currentAgent?: Agent | undefined;
  streamingStatus?: StreamStatus | undefined;
}

export const MessageItem: React.FC<MessageItemProps> = memo(({
  message,
  isStreaming = false,
  onRetry,
  onEdit: _onEdit,
  onDelete: _onDelete,
  currentAgent,
  streamingStatus,
  onInteractiveSelect,
  onInteractiveFormSubmit,
}) => {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const {
    announceStreamingStatus,
    announceNewMessage,
  } = useA11yAnnouncer();
  // 🚀 性能优化：使用useCallback缓存事件处理函数
  const isInteractiveSelect = useCallback((params: InteractiveSelectParams | InteractiveInputParams): params is InteractiveSelectParams => {
    return 'userSelectOptions' in params;
  }, []);

  const isInteractiveInput = useCallback((params: InteractiveSelectParams | InteractiveInputParams): params is InteractiveInputParams => {
    return 'inputForm' in params;
  }, []);

  const handleCopy = useCallback(async () => {
    if (copied) {
      return;
    }

    const content = message.AI || message.HUMAN || '';
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [message.AI, message.HUMAN, copied, setCopied]);

  // 交互节点专用渲染（优先于普通 HUMAN/AI 文本）
  if (message.interactive) {
    const data = message.interactive;

    // userInput 表单的本地状态
    const [formValues, setFormValues] = useState({});

    // userSelect 下拉选择的本地状态
    const [selectedValue, setSelectedValue] = useState(() => {
      if (isInteractiveSelect(data.params)) {
        const opts = data.params.userSelectOptions || [];
        return (opts[0]?.key ?? opts[0]?.value ?? '');
      }
      return '';
    });

    const renderUserSelect = () => (
      <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-[80%] w-full">
          <OptimizedImage
            src={avatarImg}
            alt="AI"
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted"
            width={32}
            height={32}
            lazy={false}
            priority={true}
          />
          <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
            <div className="text-sm text-foreground mb-3 whitespace-pre-wrap">
              {data.params?.description || t('请选择一个选项以继续')}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
              >
                {isInteractiveSelect(data.params) && data.params.userSelectOptions?.map((opt, idx: number) => (
                  <option key={idx} value={String(opt.key ?? opt.value)}>
                    {String(opt.value ?? opt.key)}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => {
                  if (data.origin === 'init' && isInteractiveSelect(data.params)) {
                    const varKey = data.params?.varKey;
                    if (varKey) {
                      const selectParams: { origin: 'init'; key: string; value: string } = {
                        origin: 'init',
                        key: varKey,
                        value: selectedValue,
                      };
                      onInteractiveSelect?.(selectParams);
                    } else {
                      const selectParams: { origin: 'init'; value: string } = {
                        origin: 'init',
                        value: selectedValue,
                      };
                      onInteractiveSelect?.(selectParams);
                    }
                  } else {
                    onInteractiveSelect?.(selectedValue);
                  }
                }}
                variant="brand"
                size="md"
                radius="md"
                className="px-3 py-1.5"
              >

                {data.origin === 'init' ? t('开始对话') : t('确定')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );

    const renderUserInput = () => (
      <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-[80%] w-full">
          <OptimizedImage
            src={avatarImg}
            alt="AI"
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted"
            width={32}
            height={32}
            lazy={false}
            priority={true}
          />
          <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
            <div className="text-sm text-gray-700 dark:text-gray-200 mb-3 whitespace-pre-wrap">
              {data.params?.description || t('请填写表单以继续')}
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (data.origin === 'init') {
                  onInteractiveFormSubmit?.({ origin: 'init', values: formValues });
                } else {
                  onInteractiveFormSubmit?.(formValues);
                }
              }}
            >
              {isInteractiveInput(data.params) && data.params.inputForm?.map((item: InteractiveFormItem, idx: number) => {
                const key = item.key || `field_${idx}`;
                const label = item.label || key;
                const type = item.type || 'input';

                return (
                  <div key={idx} className="flex items-center gap-3">
                    <label className="w-28 text-sm text-muted-foreground">{label}</label>
                    {type === 'numberInput' ? (
                      <input
                        type="number"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
                        onChange={(e) => setFormValues((s) => ({ ...s, [key]: Number(e.target.value) }))}
                      />
                    ) : type === 'select' ? (
                      <select
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
                        onChange={(e) => setFormValues((s) => ({ ...s, [key]: e.target.value }))}
                      >
                        {(item.list || []).map((opt, i: number) => (
                          <option key={i} value={String(opt.value)}>
                            {String(opt.label ?? opt.value)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
                        onChange={(e) => setFormValues((s) => ({ ...s, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="brand"
                  size="md"
                  radius="md"
                  className="px-4 py-2 text-sm"
                >
                  {data.origin === 'init' ? t('开始对话') : t('提交')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );

    if (data.type === 'userSelect') {
      return renderUserSelect();
    }
    if (data.type === 'userInput') {
      return renderUserInput();
    }
  }

  const [likeLoading, setLikeLoading] = useState(false);

  // huihua.md 格式：检查是用户消息还是 AI 消息
  const isUser = message.HUMAN !== undefined;
  const content = isUser ? message.HUMAN : message.AI;

  // 从全局store获取当前会话和反馈更新方法
  const { currentSession, setMessageFeedback } = useChatStore();
  const agent = currentAgent; // 已通过props传入
  const canFeedback = !isUser && !!message.id && agent?.provider === 'fastgpt';

  // 可访问性：新消息通知
  useEffect(() => {
    if (message.id) {
      announceNewMessage(isUser);
    }
  }, [message.id, isUser, announceNewMessage]);

  // 可访问性：流式状态通知
  useEffect(() => {
    if (streamingStatus?.type === 'flowNodeStatus' && streamingStatus.moduleName) {
      announceStreamingStatus(
        streamingStatus.moduleName,
        streamingStatus.status || 'running',
      );
    }
  }, [streamingStatus, announceStreamingStatus]);

  // 由消息上的持久化字段推导本地显示态
  const liked: boolean | null = message.feedback === 'good' ? true : message.feedback === 'bad' ? false : null;

  const submitFeedback = async (type: 'good' | 'bad', cancel = false) => {
    if (!canFeedback || !agent || !currentSession) {
      return;
    }
    setLikeLoading(true);
    try {
      await chatService.updateUserFeedback(agent.id, currentSession.id, message.id!, type, cancel);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleLikeClick = async () => {
    if (!canFeedback || likeLoading) {
      return;
    }
    try {
      if (liked === true) {
        await submitFeedback('good', true);
        setMessageFeedback(message.id!, null);
      } else {
        if (liked === false) {
          await submitFeedback('bad', true);
        }
        await submitFeedback('good', false);
        setMessageFeedback(message.id!, 'good');
      }
    } catch (e) {
      console.error(t('点赞操作失败'), e);
    }
  };

  const handleDislikeClick = async () => {
    if (!canFeedback || likeLoading) {
      return;
    }
    try {
      if (liked === false) {
        await submitFeedback('bad', true);
        setMessageFeedback(message.id!, null);
      } else {
        if (liked === true) {
          await submitFeedback('good', true);
        }
        await submitFeedback('bad', false);
        setMessageFeedback(message.id!, 'bad');
      }
    } catch (e) {
      console.error(t('点踩操作失败'), e);
    }
  };

  const formatTime = (timestamp?: number) => {
    const time = timestamp ? new Date(timestamp) : new Date();
    return time.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 用户消息样式
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="bg-brand text-brand-foreground rounded-2xl px-4 py-3 shadow-sm">
            <div className="whitespace-pre-wrap break-words">
              {content}
            </div>
            <div className="text-xs text-blue-100 mt-2 text-right">
              {formatTime(message.timestamp)}
            </div>
          </div>
          <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-border">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // 助手消息样式
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[80%] w-full">
        <OptimizedImage
            src={avatarImg}
            alt="AI"
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted"
            width={32}
            height={32}
            lazy={false}
            priority={true}
          />

        <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
          {message.reasoning?.steps && message.reasoning.steps.length > 0 && (
            <ReasoningTrail
              steps={message.reasoning.steps}
              {...(message.reasoning.totalSteps !== undefined && { totalSteps: message.reasoning.totalSteps })}
              isStreaming={isStreaming && !message.reasoning.finished}
              finished={!!message.reasoning.finished}
            />
          )}

          {message.events && message.events.length > 0 && (
            <EventTrail events={message.events} />
          )}

          {/* 消息内容 */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeHighlight, rehypeRaw]}
              components={{
                code: ({ className, children, ...props }: CodeProps): JSX.Element => {
                  const match = className ? /language-(\\w+)/.exec(className) : null;
                  const isBlock = match && className;

                  if (isBlock) {
                    return (
                      <div className="relative group">
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={() => navigator.clipboard.writeText(String(children))}
                            variant="secondary"
                            size="sm"
                            radius="md"
                            className="px-2 py-1 h-auto text-xs"
                          >
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border border-border rounded-lg overflow-x-auto p-4 text-sm">
                          <code className={className}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  }

                  return (
                    <code className="bg-muted px-1 py-0.5 rounded text-sm text-muted-foreground" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>

            {/* 在气泡内部渲染 FastGPT 状态面板（替代原三点动画） */}
            {isStreaming && currentAgent?.provider === 'fastgpt' && (
              <div className="flex justify-start mt-2">
                <div className="flex items-center space-x-2 px-4 py-2 rounded-lg shadow-sm border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {/* 简单的“流程节点”图标 */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="6" cy="12" r="2" />
                    <circle cx="12" cy="6" r="2" />
                    <circle cx="18" cy="12" r="2" />
                    <path d="M8 12h4M14 10l2-2M14 12h2" />
                  </svg>
                  {/* 三点动画 */}
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-sm" />
                  {streamingStatus?.type === 'flowNodeStatus' && (
                    <>
                      <span className="text-sm font-medium">{streamingStatus.moduleName || t('未知模块')}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-1 ${
                        streamingStatus.status === 'error'
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : (streamingStatus.status === 'completed'
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300')
                      }`}>
                        {streamingStatus.status || 'running'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 消息元数据 */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{formatTime(message.timestamp)}</span>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <IconButton
                onClick={handleCopy}
                variant="ghost"
                radius="md"
                title={t('复制')}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </IconButton>

              {onRetry && (
                <IconButton
                  onClick={onRetry}
                  variant="ghost"
                  radius="md"
                  className="text-muted-foreground hover:text-foreground"
                  title={t('重新生成')}
                >
                  <RotateCcw className="h-4 w-4" />
                </IconButton>
              )}

              {canFeedback && (
                <>
                  <IconButton
                    onClick={handleLikeClick}
                    variant="ghost"
                    radius="md"
                    disabled={likeLoading}
                    className={`${
                      liked === true
                        ? 'text-green-500'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={t('点赞')}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </IconButton>

                  <IconButton
                    onClick={handleDislikeClick}
                    variant="ghost"
                    radius="md"
                    disabled={likeLoading}
                    className={`${
                      liked === false
                        ? 'text-red-500'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={t('点踩')}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </IconButton>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，优化重新渲染
  return (
    prevProps.message === nextProps.message &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.currentAgent === nextProps.currentAgent &&
    prevProps.streamingStatus === nextProps.streamingStatus
  );
});