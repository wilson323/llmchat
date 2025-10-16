/**
 * OptimizedMessageItem - High-performance chat message component
 *
 * Performance optimizations:
 * 1. React.memo with custom comparison
 * 2. useMemo for expensive calculations
 * 3. useCallback for stable function references
 * 4. Lazy loading for heavy components
 * 5. Intersection Observer for lazy loading
 */

;
;
;
;
;
;
;
;
;
import {Bot, Copy, Loader2, RefreshCw, ThumbsDown, ThumbsUp, User} from 'lucide-react';
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { ChatMessage } from '@/types';
import { useI18n } from '@/i18n';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
;
;
;
;
;
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  usePerformanceMonitor
} from '@/utils/performanceOptimizer';

interface OptimizedMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  isLastMessage?: boolean;
  currentAgent?: any;
  streamingStatus?: any;
  onRetry?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'good' | 'bad') => void;
}

// Performance monitoring
const MessageItemPerfMonitor = () => {
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    setRenderCount((prev: any) => prev + 1);
  });

  return { renderCount };
};

export const OptimizedMessageItem = React.memo<OptimizedMessageItemProps>(({
  message,
  isStreaming = false,
  isLastMessage = false,
  currentAgent,
  streamingStatus,
  onRetry,
  onCopy,
  onFeedback,
}) => {
  // Performance monitoring
  usePerformanceMonitor('OptimizedMessageItem');
  const { renderCount } = MessageItemPerfMonitor();

  const { t } = useI18n();
  const messageRef = useRef(null);
  const contentRef = useRef(null);

  // Intersection Observer for lazy loading heavy components
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Memoize expensive calculations
  const messageContent = useMemo(() => {
    return message.AI || message.HUMAN || '';
  }, [message.AI, message.HUMAN]);

  const messageTimestamp = useMemo(() => {
    return message.timestamp ? new Date(message.timestamp) : new Date();
  }, [message.timestamp]);

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(messageTimestamp, { addSuffix: true });
  }, [messageTimestamp]);

  const isUserMessage = useMemo(() => {
    return message.HUMAN !== undefined;
  }, [message.HUMAN]);

  const isAssistantMessage = useMemo(() => {
    return message.AI !== undefined;
  }, [message.AI]);

  const hasAttachments = useMemo(() => {
    return message.attachments && message.attachments.length > 0;
  }, [message.attachments]);

  const hasVoiceNote = useMemo(() => {
    return message.voiceNote !== undefined;
  }, [message.voiceNote]);

  const hasInteractive = useMemo(() => {
    return message.interactive !== undefined;
  }, [message.interactive]);

  const hasReasoning = useMemo(() => {
    return message.reasoning && message.reasoning.steps && message.reasoning.steps.length > 0;
  }, [message.reasoning]);

  const hasEvents = useMemo(() => {
    return message.events && message.events.length > 0;
  }, [message.events]);

  // Calculate message metadata once
  const messageMetadata = useMemo(() => {
    const hasEmojis = /[\u2600-\u27BF]|[\uD83C][\uDC00-\uDFFF]|[\uD83D][\uDC00-\uDFFF]|[\uD83E][\uDD10-\uDDFF]/g.test(messageContent);

    const metadata = {
      wordCount: messageContent.split(/\s+/).length,
      charCount: messageContent.length,
      lineCount: messageContent.split('\n').length,
      hasCode: /```/u.test(messageContent),
      hasLinks: /https?:\/\/[^\s]+/.test(messageContent),
      hasEmojis,
      complexity: 0
    };

    // Calculate estimated render complexity
    metadata.complexity =
      (metadata.wordCount > 500 ? 3 : metadata.wordCount > 100 ? 2 : 1) +
      (metadata.hasCode ? 2 : 0) +
      (hasReasoning ? 3 : 0) +
      (hasEvents ? 2 : 0) +
      (hasAttachments ? 2 : 0) +
      (hasInteractive ? 2 : 0);

    return metadata;
  }, [messageContent, hasReasoning, hasEvents, hasAttachments, hasInteractive]);

  // Stable function references
  const handleCopy = useCallback(() => {
    if (onCopy) {
      onCopy(messageContent);
      toast.success(t('消息已复制到剪贴板'));
    }
  }, [messageContent, onCopy, t]);

  const handleRetry = useCallback(() => {
    if (onRetry && message.id) {
      onRetry(message.id);
    }
  }, [onRetry, message.id]);

  const handleFeedback = useCallback((feedback: 'good' | 'bad') => {
    if (onFeedback && message.id) {
      onFeedback(message.id, feedback);
    }
  }, [onFeedback, message.id]);

  // Intersection Observer setup
  useEffect(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
            }
          });
        },
        {
          root: null,
          rootMargin: '50px',
          threshold: 0.1
        }
      );
    }

    const currentRef = messageRef.current;
    if (currentRef) {
      observerRef.current.observe(currentRef);
    }

    return () => {
      if (currentRef && observerRef.current) {
        observerRef.current.unobserve(currentRef);
      }
    };
  }, []);

  // Lazy load heavy components when visible
  const ReasoningTrail = useMemo(() => {
    return React.lazy(() => import('./ReasoningTrail'));
  }, []);

  const EventTrail = useMemo(() => {
    return React.lazy(() => import('./EventTrail'));
  }, []);

  const InteractiveComponent = useMemo(() => {
    return React.lazy(() => import('./InteractiveComponent'));
  }, []);

  // Memory optimization: Cleanup heavy resources when unmounted
  useEffect(() => {
    return () => {
      // Cleanup heavy resources
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div
      ref={messageRef}
      className={`flex gap-3 p-4 rounded-lg ${
        isUserMessage
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : 'bg-muted/50 dark:bg-muted/30'
      } transition-all duration-200 ease-in-out`}
      role="article"
      aria-label={isUserMessage ? t('用户消息') : t('AI回复')}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar className="w-8 h-8">
          {currentAgent?.avatar ? (
            <Avatar.Image
              src={currentAgent.avatar}
              alt={currentAgent.name}
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Avatar.Fallback className={isUserMessage ? 'bg-primary' : 'bg-secondary'}>
              {isUserMessage ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </Avatar.Fallback>
          )}
        </Avatar>
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {/* Message Header */}
            <div className="flex items-center gap-2 mb-2">
              {isUserMessage ? (
                <Badge variant="secondary">{t('您')}</Badge>
              ) : (
                <Badge variant="secondary">{currentAgent?.name || t('AI助手')}</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formattedTime}
              </span>
              {messageMetadata.complexity > 3 && (
                <Badge variant="secondary" className="text-xs">
                  {t('复杂内容')}
                </Badge>
              )}
            </div>

            {/* Message Content */}
            <div
              ref={contentRef}
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: messageContent }}
            />

            {/* Attachments */}
            {hasAttachments && (
              <div className="mt-3 space-y-2">
                {message.attachments?.map((attachment, index) => (
                  <Card key={index} className="p-2 bg-card">
                    <div className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <span className="text-xs">{attachment.name.split('.').pop()?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.size ? formatFileSize(attachment.size) : ''}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(attachment.url, '_blank')}
                        >
                          {t('查看')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Voice Note */}
            {hasVoiceNote && (
              <div className="mt-3">
                <Card className="p-2 bg-card">
                  <div className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-xs">🎤</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t('语音消息')}</p>
                        <p className="text-xs text-muted-foreground">
                          {message.voiceNote?.duration.toFixed(1)}s
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => message.voiceNote?.url && window.open(message.voiceNote.url, '_blank')}
                      >
                        {t('播放')}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Interactive Elements */}
            {hasInteractive && isVisible && (
              <div className="mt-3">
                <React.Suspense fallback={<div className="animate-pulse h-20 bg-muted rounded" />}>
                  <InteractiveComponent
                    interactive={message.interactive!}
                  />
                </React.Suspense>
              </div>
            )}

            {/* Reasoning Trail */}
            {hasReasoning && isVisible && (
              <div className="mt-3">
                <React.Suspense fallback={<div className="animate-pulse h-16 bg-muted rounded" />}>
                  <ReasoningTrail
                    steps={message.reasoning!.steps}
                    {...(message.reasoning!.totalSteps !== undefined && { totalSteps: message.reasoning!.totalSteps })}
                    isStreaming={isStreaming}
                    {...(message.reasoning!.finished !== undefined && { finished: message.reasoning!.finished })}
                  />
                </React.Suspense>
              </div>
            )}

            {/* Event Trail */}
            {hasEvents && isVisible && (
              <div className="mt-3">
                <React.Suspense fallback={<div className="animate-pulse h-12 bg-muted rounded" />}>
                  <EventTrail events={message.events!} />
                </React.Suspense>
              </div>
            )}

            {/* Streaming Status */}
            {isStreaming && isLastMessage && (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {t('正在生成...')}
                </span>
                {streamingStatus && (
                  <span className="text-xs text-muted-foreground">
                    {streamingStatus.status}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0"
              title={t('复制消息')}
            >
              <Copy className="w-4 h-4" />
            </Button>

            {isAssistantMessage && message.id && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('good')}
                  className="h-8 w-8 p-0"
                  title={t('点赞')}
                >
                  <ThumbsUp className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('bad')}
                  className="h-8 w-8 p-0"
                  title={t('点踩')}
                >
                  <ThumbsDown className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRetry}
                  className="h-8 w-8 p-0"
                  title={t('重试')}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Performance Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground mt-2">
            Renders: {renderCount} |
            Complexity: {messageMetadata.complexity} |
            Words: {messageMetadata.wordCount} |
            Chars: {messageMetadata.charCount}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.AI === nextProps.message.AI &&
    prevProps.message.HUMAN === nextProps.message.HUMAN &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    prevProps.currentAgent?.id === nextProps.currentAgent?.id
  );
});

OptimizedMessageItem.displayName = 'OptimizedMessageItem';

// Helper function for formatting file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default OptimizedMessageItem;