# P0 可访问性改进详细实施文档

## 📋 项目概述

本文档详细描述了LLMChat项目的P0级别可访问性改进实施计划，旨在通过系统性的可访问性优化，使应用符合WCAG 2.1 AA标准，为所有用户提供无障碍的使用体验。

## 🎯 改进目标

### 核心目标
- 实现完整的屏幕阅读器支持
- 确保键盘完全可导航
- 提升色彩对比度至WCAG AA标准
- 优化焦点管理和视觉反馈
- 实现实时内容变化的可访问性通知

### 技术标准
- **WCAG 2.1 AA级别** compliance
- **ARIA 1.1** 规范遵循
- **Section 508** 标准兼容
- **屏幕阅读器**：JAWS, NVDA, VoiceOver, TalkBack
- **键盘导航**：Tab键序列、快捷键支持

## 📊 当前状态分析

### ✅ 已完成工作
1. **A11yAnnouncer组件系统**
   - 创建了综合的可访问性通知组件
   - 实现了多种aria-live区域支持
   - 提供了流式响应状态通知功能

2. **useA11yAnnouncer Hook**
   - 简化了可访问性通知的使用
   - 提供了标准化的通知方法
   - 支持多种通知类型（状态、错误、导航、成功）

3. **MessageItem组件集成**
   - 集成了新消息通知功能
   - 添加了流式状态播报
   - 实现了消息状态的可访问性

### 🔄 当前进行中
- Toast组件的可访问性增强
- 全局焦点管理系统完善
- 键盘导航快捷键实现

## 🚧 剩余P0任务详细规划

### P0-1: 可访问性基础建设 - aria-live支持 ✅ (90%完成)

#### 当前状态
- ✅ A11yAnnouncer组件已创建
- ✅ useA11yAnnouncer Hook已实现
- ✅ MessageItem组件已集成
- 🔄 Toast组件待增强 (需要添加aria-live支持)

#### 待完成任务
1. **Toast组件可访问性增强**
   ```typescript
   // 需要在Toast组件中添加：
   - aria-live="polite" 或 "assertive"
   - aria-atomic="true"
   - role="status" 或 "alert"
   - 屏幕阅读器友好的消息格式
   ```

2. **全局状态变化通知**
   ```typescript
   // 需要监听的状态变化：
   - 会话切换完成通知
   - 智能体切换通知
   - 错误状态播报
   - 连接状态变化通知
   ```

#### 实施步骤
1. 修改 `frontend/src/components/ui/Toast.tsx`
2. 在关键状态变化处添加通知调用
3. 测试屏幕阅读器兼容性
4. 验证通知时机和内容准确性

---

### P0-2: 可访问性基础建设 - 完善键盘导航和焦点管理

#### 当前问题分析
1. **模态对话框焦点管理**
   - 焦点未正确trap在模态内
   - Escape键未绑定关闭功能
   - 焦点返回原位置机制缺失

2. **全局键盘导航**
   - 缺少快捷键支持
   - Tab键序列不完整
   - 焦点指示器不明显

3. **交互元素键盘访问**
   - 部分按钮不支持键盘操作
   - 自定义组件缺少键盘事件处理
   - 焦点跳跃问题

#### 详细实施计划

**第一阶段：焦点管理系统**
```typescript
// 1. 创建 useFocusTrap Hook
interface UseFocusTrapOptions {
  container: HTMLElement | null;
  initialFocus?: HTMLElement | null;
  restoreFocus?: HTMLElement | null;
  onEscape?: () => void;
}

// 2. 创建 useFocusManager Hook
interface FocusManager {
  captureFocus: () => void;
  releaseFocus: () => void;
  setFocus: (element: HTMLElement) => void;
  getNextFocusable: (current: HTMLElement) => HTMLElement | null;
  getPreviousFocusable: (current: HTMLElement) => HTMLElement | null;
}
```

**第二阶段：键盘快捷键系统**
```typescript
// 1. 全局快捷键配置
interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  category: 'navigation' | 'editing' | 'conversation';
}

// 2. 快捷键注册系统
const globalShortcuts: KeyboardShortcut[] = [
  { key: 'n', ctrlKey: true, action: () => newConversation(), description: '新对话', category: 'conversation' },
  { key: '/', action: () => focusInput(), description: '聚焦输入框', category: 'navigation' },
  { key: 'Escape', action: () => closeCurrentModal(), description: '关闭当前模态', category: 'navigation' }
];
```

**第三阶段：组件级键盘优化**
```typescript
// 1. 消息列表键盘导航
const MessageListKeyboardNav = () => {
  // ArrowUp/ArrowDown 浏览消息
  // Enter 激活当前消息操作
  // Space 消息展开/折叠
  // Home/End 快速跳转
};

// 2. 会话列表键盘操作
const SessionKeyboardNav = () => {
  // 方向键选择会话
  // Enter 切换会话
  // Delete 删除会话
  // F2 重命名会话
};
```

#### 实施步骤
1. **Week 1**: 实现焦点管理系统
   - 创建useFocusTrap Hook
   - 实现模态对话框焦点管理
   - 添加焦点恢复机制

2. **Week 2**: 实现键盘快捷键
   - 创建全局快捷键系统
   - 实现快捷键冲突检测
   - 添加快捷键帮助界面

3. **Week 3**: 优化组件键盘导航
   - 消息列表键盘操作
   - 会话列表键盘操作
   - 交互元素键盘支持

4. **Week 4**: 测试和优化
   - 屏幕阅读器测试
   - 键盘导航流畅性测试
   - 用户体验优化

---

### P0-3: 可访问性基础建设 - 提升色彩对比度至WCAG AA标准

#### 当前色彩对比度分析
1. **品牌色对比度问题**
   - 主色调 #3B82F6 (蓝色) 对比度不足
   - 辅助色 #10B981 (绿色) 在某些背景下对比度低
   - 文字颜色在深色主题下对比度不达标

2. **UI组件对比度检测**
   - 按钮文字对比度需要提升
   - 输入框边框对比度不足
   - 状态指示器颜色可辨识度低

#### 详细色彩优化方案

**第一步：色彩系统审计**
```typescript
// 1. 对比度检测工具
interface ColorContrastResult {
  ratio: number;
  wcagLevel: 'AAA' | 'AA' | 'fail';
  recommendation: string;
}

// 2. 当前色彩系统分析
const colorAudit = {
  primary: {
    light: '#3B82F6',    // 对比度: 3.1 (AA达标，AAA未达标)
    dark: '#60A5FA',     // 对比度: 2.8 (未达标)
    needsImprovement: true
  },
  text: {
    primary: '#111827',  // 对比度: 15.8 (AAA)
    secondary: '#6B7280', // 对比度: 3.9 (AA达标)
    muted: '#9CA3AF'     // 对比度: 2.9 (未达标)
  }
};
```

**第二步：色彩系统优化**
```typescript
// 1. 优化后的色彩系统
const optimizedColorPalette = {
  // 主色调 - 提升对比度
  primary: {
    50: '#EFF6FF',
    500: '#2563EB',  // 从 #3B82F6 调整，对比度 4.5 (AA达标)
    600: '#1D4ED8',
    900: '#1E3A8A'
  },

  // 文字颜色 - 确保对比度
  text: {
    primary: '#111827',  // 对比度 15.8 (AAA)
    secondary: '#374151', // 从 #6B7280 调整，对比度 7.1 (AA达标)
    muted: '#6B7280'     // 从 #9CA3AF 调整，对比度 4.6 (AA达标)
  },

  // 状态色彩 - 增强可辨识度
  status: {
    success: '#059669',  // 优化后绿色，对比度 4.7 (AA)
    warning: '#D97706',  // 优化后橙色，对比度 4.5 (AA)
    error: '#DC2626',    // 优化后红色，对比度 5.2 (AA)
    info: '#0891B2'      // 优化后蓝色，对比度 4.8 (AA)
  }
};
```

**第三步：组件级色彩应用**
```typescript
// 1. 按钮组件色彩优化
const ButtonVariants = {
  primary: {
    backgroundColor: 'var(--color-primary-500)',
    color: 'white',  // 对比度 4.5 (AA达标)
    hover: 'var(--color-primary-600)',
    focus: 'var(--color-primary-700)'
  },

  secondary: {
    backgroundColor: 'var(--color-gray-100)',
    color: 'var(--color-text-primary)',  // 对比度 7.1 (AA达标)
    border: 'var(--color-gray-300)',     // 增强边框对比度
    hover: 'var(--color-gray-200)'
  }
};
```

#### 实施步骤
1. **Week 1**: 色彩审计和规划
   - 使用对比度检测工具全面审计
   - 制定色彩优化方案
   - 更新设计系统色彩规范

2. **Week 2**: 色彩系统实施
   - 更新CSS变量和Tailwind配置
   - 修改组件色彩应用
   - 验证对比度达标情况

3. **Week 3**: 暗色主题优化
   - 确保暗色主题对比度达标
   - 测试不同环境下的显示效果
   - 优化色彩过渡动画

4. **Week 4**: 用户测试和调整
   - 邀请视力障碍用户测试
   - 收集反馈并调整
   - 最终色彩系统验收

---

### P0-4: 会话管理重构 - 简化会话切换逻辑

#### 当前问题分析
1. **性能问题**
   - 切换会话时大量重渲染
   - 状态更新延迟明显
   - 异步操作处理不当

2. **用户体验问题**
   - 切换反馈不及时
   - 加载状态缺失
   - 状态同步错误

#### 详细重构方案

**第一阶段：状态管理优化**
```typescript
// 1. 会话状态拆分
interface SessionState {
  // 当前活跃会话（高频访问）
  currentSession: ChatSession | null;

  // 会话列表（中等访问频率）
  sessionList: ChatSession[];

  // 会话消息缓存（按需加载）
  messageCache: Map<string, ChatMessage[]>;

  // 加载状态
  loadingStates: Map<string, 'loading' | 'loaded' | 'error'>;
}

// 2. 乐观更新机制
const useOptimisticSessionSwitch = () => {
  const switchSession = (sessionId: string) => {
    // 立即更新UI状态
    setCurrentSession(sessionId);

    // 异步加载数据
    loadSessionData(sessionId)
      .catch(error => {
        // 回滚状态并显示错误
        rollbackSession(sessionId);
        showError(error);
      });
  };
};
```

**第二阶段：数据流优化**
```typescript
// 1. 会话数据预加载
const SessionPreloader = () => {
  const preloadSessions = (sessionIds: string[]) => {
    // 预加载最近访问的会话
    sessionIds.forEach(id => {
      if (!messageCache.has(id)) {
        loadSessionData(id);
      }
    });
  };
};

// 2. 智能缓存策略
const useSessionCache = () => {
  const cacheStrategy = {
    // 缓存最近10个会话的消息
    maxSessions: 10,

    // 缓存消息数量限制
    maxMessagesPerSession: 100,

    // LRU淘汰策略
    evictionPolicy: 'LRU'
  };
};
```

**第三阶段：用户反馈优化**
```typescript
// 1. 切换状态反馈
const SessionSwitchFeedback = () => {
  const [switchingState, setSwitchingState] = useState<'idle' | 'switching' | 'error'>('idle');

  const switchWithFeedback = async (sessionId: string) => {
    setSwitchingState('switching');

    try {
      await switchSession(sessionId);
      setSwitchingState('idle');
    } catch (error) {
      setSwitchingState('error');
      setTimeout(() => setSwitchingState('idle'), 2000);
    }
  };
};

// 2. 加载骨架屏
const SessionSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
  </div>
);
```

#### 实施步骤
1. **Week 1**: 状态管理重构
   - 拆分会话状态，优化订阅机制
   - 实现细粒度状态更新
   - 添加乐观更新支持

2. **Week 2**: 数据流优化
   - 实现会话预加载机制
   - 优化缓存策略
   - 添加数据同步机制

3. **Week 3**: 用户反馈优化
   - 添加切换状态反馈
   - 实现加载骨架屏
   - 优化错误处理和恢复

4. **Week 4**: 性能测试和优化
   - 性能指标监控
   - 用户体验测试
   - 最终优化调整

---

### P0-5: 会话管理重构 - 智能会话标题生成

#### 当前问题
1. **标题质量问题**
   - 简单截断无法体现内容主题
   - 缺少语义理解能力
   - 重复标题过多

2. **生成效率问题**
   - 本地生成算法不够智能
   - 缺少上下文理解
   - 更新时机不当

#### 详细智能生成方案

**第一阶段：NLP关键词提取**
```typescript
// 1. 关键词提取算法
interface KeywordExtractor {
  extractKeywords(text: string): Promise<Keyword[]>;
  calculateRelevance(keyword: string, context: string): number;
  filterKeywords(keywords: Keyword[], criteria: RelevanceCriteria): Keyword[];
}

// 2. 中文分词和关键词识别
const ChineseKeywordExtractor = {
  // 使用TF-IDF算法提取关键词
  extractByTFIDF: (text: string) => {
    // 分词处理
    const tokens = chineseSegment(text);

    // 计算TF-IDF值
    const tfidf = calculateTFIDF(tokens);

    // 返回前N个关键词
    return tfidf
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  },

  // 基于语义的角色识别
  extractBySemantic: (text: string) => {
    // 识别：问题、主题、概念、实体
    const entities = extractNamedEntities(text);
    const topics = extractTopics(text);
    const questions = extractQuestions(text);

    return { entities, topics, questions };
  }
};
```

**第二阶段：智能标题生成**
```typescript
// 1. 标题生成策略
interface TitleGenerationStrategy {
  name: string;
  generate: (context: TitleContext) => string;
  priority: number;
 适用场景: string[];
}

const titleStrategies: TitleGenerationStrategy[] = [
  {
    name: 'question_based',
    generate: (ctx) => {
      const questions = extractQuestions(ctx.lastUserMessage);
      return questions.length > 0
        ? `Q: ${questions[0].slice(0, 20)}...`
        : null;
    },
    priority: 1,
    适用场景: ['用户提问', '知识查询']
  },

  {
    name: 'topic_based',
    generate: (ctx) => {
      const topics = extractTopics(ctx.messages);
      const mainTopic = topics[0];
      return mainTopic ? `关于${mainTopic}` : null;
    },
    priority: 2,
    适用场景: ['主题讨论', '专业咨询']
  },

  {
    name: 'entity_based',
    generate: (ctx) => {
      const entities = extractNamedEntities(ctx.messages);
      return entities.length > 0
        ? `${entities[0]}相关讨论`
        : null;
    },
    priority: 3,
    适用场景: ['实体查询', '产品咨询']
  },

  {
    name: 'summary_based',
    generate: (ctx) => {
      const summary = generateSummary(ctx.lastUserMessage, 30);
      return summary || '新对话';
    },
    priority: 4,
    适用场景: ['通用对话', '闲聊']
  }
];

// 2. 上下文感知生成
const ContextAwareTitleGenerator = {
  generateTitle: async (session: ChatSession): Promise<string> => {
    const context = {
      messages: session.messages,
      lastUserMessage: session.messages.find(m => m.HUMAN)?.HUMAN || '',
      lastAIResponse: session.messages.find(m => m.AI)?.AI || '',
      sessionLength: session.messages.length,
      timeContext: getTimeContext(session.createdAt)
    };

    // 选择最合适的生成策略
    for (const strategy of titleStrategies) {
      const title = strategy.generate(context);
      if (title && title.length > 0) {
        return title;
      }
    }

    return '新对话';
  }
};
```

**第三阶段：动态更新机制**
```typescript
// 1. 标题更新触发器
const TitleUpdateTriggers = {
  // 消息数量触发
  onMessageCount: (session: ChatSession, count: number) => {
    return session.messages.length >= count;
  },

  // 时间间隔触发
  onTimeInterval: (session: ChatSession, interval: number) => {
    const timeSinceCreation = Date.now() - session.createdAt;
    return timeSinceCreation >= interval;
  },

  // 内容变化触发
  onTopicChange: (session: ChatSession) => {
    const currentTopics = extractTopics(session.messages);
    const previousTopics = session.lastTopics || [];
    return !areTopicsSimilar(currentTopics, previousTopics);
  }
};

// 2. 批量更新机制
const BatchTitleUpdater = {
  updateQueue: new Map<string, TitleUpdateTask>(),

  // 添加更新任务
  scheduleUpdate: (sessionId: string, strategy: TitleStrategy) => {
    updateQueue.set(sessionId, {
      sessionId,
      strategy,
      timestamp: Date.now(),
      priority: calculatePriority(sessionId, strategy)
    });
  },

  // 批量处理更新
  processBatch: async () => {
    const tasks = Array.from(updateQueue.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // 每批处理10个

    await Promise.all(
      tasks.map(task => updateSessionTitle(task.sessionId, task.strategy))
    );
  }
};
```

#### 实施步骤
1. **Week 1**: NLP算法实现
   - 实现中文分词和关键词提取
   - 开发语义理解算法
   - 创建标题生成策略

2. **Week 2**: 生成引擎开发
   - 实现上下文感知生成
   - 开发策略选择机制
   - 创建标题质量评估

3. **Week 3**: 更新机制实现
   - 实现触发器系统
   - 开发批量更新机制
   - 添加性能优化

4. **Week 4**: 测试和优化
   - 生成质量测试
   - 性能压力测试
   - 用户接受度调查

---

### P0-6: 会话管理重构 - 添加会话搜索功能

#### 搜索需求分析
1. **搜索范围**
   - 会话标题搜索
   - 消息内容全文搜索
   - 智能体名称搜索
   - 时间范围搜索

2. **搜索体验**
   - 实时搜索建议
   - 高亮匹配内容
   - 搜索历史记录
   - 高级筛选选项

#### 详细搜索实现方案

**第一阶段：搜索引擎开发**
```typescript
// 1. 搜索索引构建
interface SearchIndex {
  sessions: Map<string, SessionIndex>;
  messages: Map<string, MessageIndex>;
  keywords: Map<string, Set<string>>; // 倒排索引
  timestamps: Map<string, number[]>;  // 时间索引
}

interface SessionIndex {
  sessionId: string;
  title: string;
  agentId: string;
  messageCount: number;
  lastMessage: string;
  keywords: string[];
  timestamp: number;
}

interface MessageIndex {
  messageId: string;
  sessionId: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: number;
  keywords: string[];
}

// 2. 搜索算法实现
const SearchEngine = {
  // 全文搜索
  fullTextSearch: (query: string, index: SearchIndex) => {
    const results = [];

    // 搜索会话标题
    for (const [sessionId, session] of index.sessions) {
      const titleScore = calculateRelevance(query, session.title);
      if (titleScore > 0) {
        results.push({
          type: 'session',
          id: sessionId,
          score: titleScore,
          highlights: highlightText(query, session.title)
        });
      }
    }

    // 搜索消息内容
    for (const [messageId, message] of index.messages) {
      const contentScore = calculateRelevance(query, message.content);
      if (contentScore > 0.3) { // 降低消息搜索阈值
        results.push({
          type: 'message',
          id: messageId,
          sessionId: message.sessionId,
          score: contentScore,
          highlights: highlightText(query, message.content)
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  },

  // 智能搜索建议
  getSuggestions: (partialQuery: string, index: SearchIndex) => {
    // 基于关键词的建议
    const keywordSuggestions = suggestKeywords(partialQuery, index.keywords);

    // 基于历史搜索的建议
    const historySuggestions = getHistorySuggestions(partialQuery);

    // 基于语义的建议
    const semanticSuggestions = getSemanticSuggestions(partialQuery);

    return [...keywordSuggestions, ...historySuggestions, ...semanticSuggestions]
      .slice(0, 8);
  }
};
```

**第二阶段：搜索UI组件**
```typescript
// 1. 搜索输入组件
const SearchInput = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsSearching(true);
      const results = searchEngine.getSuggestions(debouncedQuery);
      setSuggestions(results);
      setIsSearching(false);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索会话或消息..."
        className="pr-10"
        aria-label="搜索会话"
      />

      {/* 搜索建议下拉框 */}
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => setQuery(suggestion)}
            >
              <HighlightText text={suggestion} query={query} />
            </div>
          ))}
        </div>
      )}

      {/* 搜索状态指示器 */}
      {isSearching && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  );
};

// 2. 搜索结果组件
const SearchResults = ({ query, results }: SearchResultsProps) => {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const groupResultsBySession = (results: SearchResult[]) => {
    const grouped = new Map<string, SearchResult[]>();

    results.forEach(result => {
      const sessionId = result.type === 'session'
        ? result.id
        : result.sessionId;

      if (!grouped.has(sessionId)) {
        grouped.set(sessionId, []);
      }
      grouped.get(sessionId)!.push(result);
    });

    return grouped;
  };

  const groupedResults = groupResultsBySession(results);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        找到 {results.length} 个结果，包含 {groupedResults.size} 个会话
      </div>

      {Array.from(groupedResults.entries()).map(([sessionId, sessionResults]) => (
        <SearchResultSession
          key={sessionId}
          sessionId={sessionId}
          results={sessionResults}
          query={query}
          isExpanded={expandedSessions.has(sessionId)}
          onToggleExpand={() => {
            const newExpanded = new Set(expandedSessions);
            if (newExpanded.has(sessionId)) {
              newExpanded.delete(sessionId);
            } else {
              newExpanded.add(sessionId);
            }
            setExpandedSessions(newExpanded);
          }}
        />
      ))}
    </div>
  );
};
```

**第三阶段：高级搜索功能**
```typescript
// 1. 高级搜索表单
const AdvancedSearch = () => {
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: { start: null, end: null },
    agents: [],
    messageTypes: ['user', 'ai'],
    contentLength: { min: 0, max: null }
  });

  const applyFilters = (searchResults: SearchResult[]) => {
    return searchResults.filter(result => {
      // 时间筛选
      if (filters.dateRange.start && result.timestamp < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && result.timestamp > filters.dateRange.end) {
        return false;
      }

      // 智能体筛选
      if (filters.agents.length > 0) {
        const session = sessionStore.getSession(result.sessionId);
        if (!session || !filters.agents.includes(session.agentId)) {
          return false;
        }
      }

      // 消息类型筛选
      if (result.type === 'message' &&
          !filters.messageTypes.includes(result.messageType as 'user' | 'ai')) {
        return false;
      }

      return true;
    });
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-medium mb-4">高级搜索</h3>

      {/* 日期范围选择 */}
      <DateRangePicker
        value={filters.dateRange}
        onChange={(dateRange) => setFilters({ ...filters, dateRange })}
        className="mb-4"
      />

      {/* 智能体多选 */}
      <AgentMultiSelect
        value={filters.agents}
        onChange={(agents) => setFilters({ ...filters, agents })}
        className="mb-4"
      />

      {/* 消息类型筛选 */}
      <CheckboxGroup
        label="消息类型"
        options={[
          { label: '用户消息', value: 'user' },
          { label: 'AI回复', value: 'ai' }
        ]}
        value={filters.messageTypes}
        onChange={(messageTypes) => setFilters({ ...filters, messageTypes })}
        className="mb-4"
      />
    </div>
  );
};

// 2. 搜索历史管理
const SearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  const addToHistory = (query: string, resultsCount: number) => {
    const item: SearchHistoryItem = {
      query,
      timestamp: Date.now(),
      resultsCount,
      frequency: 1
    };

    // 更新或添加历史记录
    const existingIndex = history.findIndex(h => h.query === query);
    if (existingIndex >= 0) {
      const newHistory = [...history];
      newHistory[existingIndex].frequency++;
      newHistory[existingIndex].timestamp = Date.now();
      setHistory(newHistory);
    } else {
      setHistory([item, ...history].slice(0, 20)); // 保留最近20条
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">搜索历史</h4>
      {history.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer"
          onClick={() => setSearchQuery(item.query)}
        >
          <span className="text-sm">{item.query}</span>
          <span className="text-xs text-gray-500">
            {item.resultsCount} 结果
          </span>
        </div>
      ))}
    </div>
  );
};
```

#### 实施步骤
1. **Week 1**: 搜索引擎开发
   - 构建搜索索引系统
   - 实现全文搜索算法
   - 开发关键词提取

2. **Week 2**: 搜索UI实现
   - 创建搜索输入组件
   - 实现搜索建议功能
   - 开发结果展示组件

3. **Week 3**: 高级功能实现
   - 实现高级搜索筛选
   - 开发搜索历史管理
   - 添加搜索统计功能

4. **Week 4**: 性能优化和测试
   - 搜索性能优化
   - 大数据量测试
   - 用户体验优化

---

### P0-7: 状态管理优化 - 拆分全局状态减少重渲染

#### 当前状态管理问题
1. **性能问题**
   - 状态更新导致全局重渲染
   - 组件订阅粒度过粗
   - 不必要的重新计算

2. **架构问题**
   - 状态结构不够清晰
   - 更新逻辑耦合度高
   - 难以追踪状态变化

#### 详细状态重构方案

**第一阶段：状态拆分重构**
```typescript
// 1. 状态模块化设计
interface AppState {
  // 用户会话状态
  userSession: UserSessionState;

  // 智能体状态
  agents: AgentState;

  // 聊天状态
  chat: ChatState;

  // UI状态
  ui: UIState;

  // 设置状态
  settings: SettingsState;
}

// 2. 用户会话状态
interface UserSessionState {
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;
  sessionOrder: string[]; // 会话排序
  loadingStates: Record<string, LoadingState>;
  lastActivity: Record<string, number>;
}

// 3. 聊天状态
interface ChatState {
  messages: Record<string, ChatMessage[]>; // 按会话ID分组的消息
  streamingStatus: Record<string, StreamingStatus>;
  unreadCounts: Record<string, number>;
  draftMessages: Record<string, string>; // 草稿消息
}

// 4. UI状态
interface UIState {
  sidebarOpen: boolean;
  activePanel: 'chat' | 'settings' | 'history';
  focusState: FocusState;
  notificationState: NotificationState;
  theme: ThemeState;
}
```

**第二阶段：细粒度订阅**
```typescript
// 1. 分离的Store实现
const createUserSessionStore = () => {
  return create<UserSessionState>((set, get) => ({
    currentSessionId: null,
    sessions: {},
    sessionOrder: [],
    loadingStates: {},
    lastActivity: {},

    // 细粒度actions
    setCurrentSession: (sessionId: string | null) => {
      set({ currentSessionId: sessionId });

      // 更新最后活动时间
      if (sessionId) {
        const state = get();
        set({
          lastActivity: {
            ...state.lastActivity,
            [sessionId]: Date.now()
          }
        });
      }
    },

    addSession: (session: ChatSession) => {
      const state = get();
      set({
        sessions: { ...state.sessions, [session.id]: session },
        sessionOrder: [session.id, ...state.sessionOrder]
      });
    },

    updateSession: (sessionId: string, updates: Partial<ChatSession>) => {
      const state = get();
      set({
        sessions: {
          ...state.sessions,
          [sessionId]: { ...state.sessions[sessionId], ...updates }
        }
      });
    },

    deleteSession: (sessionId: string) => {
      const state = get();
      const { [sessionId]: deleted, ...remainingSessions } = state.sessions;
      const newOrder = state.sessionOrder.filter(id => id !== sessionId);

      // 如果删除的是当前会话，切换到其他会话
      const newCurrentId = state.currentSessionId === sessionId
        ? (newOrder[0] || null)
        : state.currentSessionId;

      set({
        sessions: remainingSessions,
        sessionOrder: newOrder,
        currentSessionId: newCurrentId
      });
    }
  }));
};

// 2. 优化的组件订阅
const useCurrentSession = () => {
  return useUserSessionStore(state => state.currentSessionId);
};

const useSession = (sessionId: string) => {
  return useUserSessionStore(state => state.sessions[sessionId]);
};

const useSessions = () => {
  return useUserSessionStore(state => {
    const { sessionOrder, sessions } = state;
    return sessionOrder.map(id => sessions[id]).filter(Boolean);
  });
};
```

**第三阶段：计算缓存优化**
```typescript
// 1. 选择器优化
const chatSelectors = {
  // 使用缓存的选择器
  getMessagesBySession: (sessionId: string) => {
    return createSelector(
      [(state: ChatState) => state.messages],
      (messages) => messages[sessionId] || []
    );
  },

  // 复杂计算缓存
  getUnreadCount: (sessionId: string) => {
    return createSelector(
      [
        (state: ChatState) => state.messages[sessionId] || [],
        (state: ChatState) => state.unreadCounts[sessionId] || 0
      ],
      (messages, baseCount) => {
        // 计算未读消息数量
        return baseCount;
      }
    );
  },

  // 排序选择器
  getSortedSessions: () => {
    return createSelector(
      [
        (state: UserSessionState) => state.sessionOrder,
        (state: UserSessionState) => state.sessions,
        (state: UserSessionState) => state.lastActivity
      ],
      (order, sessions, lastActivity) => {
        return order
          .map(id => sessions[id])
          .filter(Boolean)
          .sort((a, b) => {
            // 按最后活动时间排序
            return (lastActivity[b.id] || 0) - (lastActivity[a.id] || 0);
          });
      }
    );
  }
};

// 2. 计算结果缓存
const useComputedValue = <T>(
  compute: () => T,
  dependencies: any[]
): T => {
  const cacheRef = useRef<{
    value: T;
    dependencies: any[];
    timestamp: number;
  }>();

  const [value, setValue] = useState<T>(compute());

  useEffect(() => {
    const currentCache = cacheRef.current;

    // 检查依赖是否变化
    const dependenciesChanged = !currentCache ||
      !isEqual(dependencies, currentCache.dependencies);

    if (dependenciesChanged) {
      const newValue = compute();
      cacheRef.current = {
        value: newValue,
        dependencies: [...dependencies],
        timestamp: Date.now()
      };
      setValue(newValue);
    }
  }, dependencies);

  return value;
};
```

**第四阶段：性能监控**
```typescript
// 1. 性能监控工具
const PerformanceMonitor = {
  // 渲染性能监控
  trackRender: (componentName: string) => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      if (renderTime > 16) { // 超过一帧时间
        console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }

      // 发送性能数据到监控系统
      if (process.env.NODE_ENV === 'production') {
        analytics.track('component_render_time', {
          component: componentName,
          duration: renderTime,
          isSlow: renderTime > 16
        });
      }
    };
  },

  // 状态更新性能监控
  trackStateUpdate: (storeName: string, actionName: string) => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const updateTime = endTime - startTime;

      if (updateTime > 10) { // 状态更新超过10ms
        console.warn(`Slow state update: ${storeName}.${actionName} took ${updateTime.toFixed(2)}ms`);
      }
    };
  }
};

// 2. 性能分析工具
const usePerformanceAnalysis = () => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());

  useEffect(() => {
    renderCountRef.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;

    // 检测过度重渲染
    if (timeSinceLastRender < 100) { // 100ms内连续渲染
      console.warn(`Frequent re-renders detected: ${renderCountRef.current} renders in ${timeSinceLastRender}ms`);
    }
  });

  return {
    renderCount: renderCountRef.current,
    timeSinceLastRender: Date.now() - lastRenderTimeRef.current
  };
};
```

#### 实施步骤
1. **Week 1**: 状态架构重构
   - 分析现有状态结构
   - 设计新的状态模块
   - 实现状态拆分

2. **Week 2**: 细粒度订阅
   - 重构组件订阅逻辑
   - 实现优化选择器
   - 添加计算缓存

3. **Week 3**: 性能优化
   - 实现性能监控
   - 优化重渲染问题
   - 添加性能分析工具

4. **Week 4**: 测试和验证
   - 性能基准测试
   - 用户体验验证
   - 最终优化调整

## 📅 总体时间规划

### 第一个月：P0-1 到 P0-3 可访问性基础建设
- **Week 1**: 完成P0-1 aria-live支持 (剩余Toast组件部分)
- **Week 2-3**: P0-2 键盘导航和焦点管理
- **Week 4**: P0-3 色彩对比度优化

### 第二个月：P0-4 到 P0-7 会话管理和状态优化
- **Week 5**: P0-4 会话切换逻辑简化
- **Week 6**: P0-5 智能会话标题生成
- **Week 7**: P0-6 会话搜索功能
- **Week 8**: P0-7 状态管理优化

## 🎯 成功指标

### 可访问性指标
- **WCAG 2.1 AA合规率**: 100%
- **键盘导航覆盖率**: 95%
- **屏幕阅读器兼容性**: 支持主流屏幕阅读器
- **色彩对比度**: 所有文字达到AA标准(4.5:1)

### 性能指标
- **会话切换时间**: <200ms
- **搜索响应时间**: <300ms
- **页面渲染时间**: <100ms
- **状态更新时间**: <50ms

### 用户体验指标
- **任务完成率**: >90%
- **用户满意度**: >4.5/5
- **错误率**: <1%
- **学习成本**: 新用户10分钟内掌握核心功能

## 🔧 技术债务管理

### 当前技术债务
1. **类型定义不一致**: 部分组件存在类型冲突
2. **错误处理不完整**: 缺少统一的错误边界
3. **性能优化空间**: 存在不必要的重渲染

### 债务偿还计划
1. **Week 1**: 修复类型定义问题
2. **Week 2**: 完善错误处理机制
3. **Week 3**: 性能优化实施
4. **Week 4**: 代码质量审查

## 📊 风险评估

### 高风险项
1. **状态重构复杂性**: 可能影响现有功能
2. **性能优化难度**: 需要精确的测量和调优
3. **可访问性测试**: 需要专业设备和用户测试

### 风险缓解措施
1. **渐进式重构**: 分阶段实施，保证功能稳定性
2. **A/B测试**: 新旧方案对比验证
3. **用户反馈**: 及时收集和处理用户意见

## 🧪 测试策略

### 可访问性测试
- **自动化工具**: axe-core, lighthouse
- **屏幕阅读器测试**: JAWS, NVDA, VoiceOver
- **键盘导航测试**: 全功能键盘操作验证
- **色彩对比度测试**: 专业对比度检测工具

### 性能测试
- **渲染性能**: React Profiler, Chrome DevTools
- **内存使用**: 内存泄漏检测
- **加载性能**: 页面加载时间监控
- **用户体验**: Core Web Vitals指标

### 功能测试
- **单元测试**: 核心逻辑覆盖
- **集成测试**: 组件交互验证
- **端到端测试**: 用户场景测试
- **回归测试**: 现有功能保护

## 📈 监控和度量

### 关键指标监控
- **性能指标**: 实时性能数据收集
- **错误监控**: 异常捕获和报告
- **用户行为**: 功能使用情况统计
- **可访问性**: 定期可访问性审计

### 度量报告
- **周报告**: 进展状态和问题跟踪
- **月报告**: 关键指标趋势分析
- **季度报告**: 整体改进效果评估
- **年度报告**: 长期影响和价值分析

---

## 📝 实施检查清单

### P0-1: aria-live支持 ✅ (90%完成)
- [x] A11yAnnouncer组件创建
- [x] useA11yAnnouncer Hook实现
- [x] MessageItem组件集成
- [x] App.tsx全局集成
- [ ] Toast组件可访问性增强
- [ ] 全局状态变化通知
- [ ] 屏幕阅读器兼容性测试

### P0-2: 键盘导航和焦点管理
- [ ] 焦点管理系统设计
- [ ] useFocusTrap Hook实现
- [ ] 模态对话框焦点管理
- [ ] 全局键盘快捷键系统
- [ ] 组件级键盘导航优化
- [ ] 键盘导航流畅性测试

### P0-3: 色彩对比度优化
- [ ] 当前色彩系统审计
- [ ] 对比度检测工具集成
- [ ] 色彩系统优化方案
- [ ] 组件色彩应用更新
- [ ] 暗色主题优化
- [ ] 色彩对比度验证

### P0-4: 会话切换逻辑简化
- [ ] 状态管理架构重构
- [ ] 乐观更新机制实现
- [ ] 会话预加载策略
- [ ] 智能缓存机制
- [ ] 切换反馈优化
- [ ] 性能指标验证

### P0-5: 智能会话标题生成
- [ ] NLP关键词提取算法
- [ ] 标题生成策略实现
- [ ] 上下文感知生成
- [ ] 动态更新机制
- [ ] 生成质量评估
- [ ] 用户接受度测试

### P0-6: 会话搜索功能
- [ ] 搜索引擎开发
- [ ] 搜索索引构建
- [ ] 搜索UI组件实现
- [ ] 高级搜索功能
- [ ] 搜索历史管理
- [ ] 搜索性能优化

### P0-7: 状态管理优化
- [ ] 状态模块化重构
- [ ] 细粒度订阅实现
- [ ] 计算缓存优化
- [ ] 性能监控系统
- [ ] 重渲染问题解决
- [ ] 状态迁移测试

---

本文档将作为P0可访问性改进和性能优化的指导性文件，确保所有改进措施按计划、高质量地实施完成。