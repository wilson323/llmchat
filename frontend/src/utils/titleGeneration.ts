/**
 * 智能会话标题生成系统
 * 基于NLP关键词提取，替代简单的字符串截断
 */

import { ChatMessage } from '@/types';

// 停用词列表（不作为标题关键词）
const STOP_WORDS = [
  '的', '了', '在', '是', '我', '你', '他', '她', '它', '我们', '你们', '他们',
  '这', '那', '这个', '那个', '什么', '怎么', '为什么', '如何', '可以',
  '要', '想', '有', '没有', '会', '能', '应该', '需要', '可能', '大概',
  '一个', '一些', '很多', '所有', '每个', '各种', '不同', '相同', '类似',
  '很', '非常', '特别', '更加', '比较', '相对', '绝对', '真正',
  '然后', '还有', '另外', '同时', '或者', '以及', '包括', '比如', '例如',
  '就是', '只是', '只是', '不过', '但是', '然而', '虽然', '尽管',
  '因此', '所以', '于是', '接着', '之后', '最后', '首先', '其次', '再次',
  '好的', '嗯', '啊', '哦', '唉', '哈', '嘿', '哟', '哇',
];

// 行业领域关键词
const DOMAIN_KEYWORDS = {
  technology: ['编程', '代码', '开发', '软件', '系统', '网站', '应用', '程序'],
  business: ['公司', '业务', '市场', '营销', '销售', '客户', '产品', '服务'],
  science: ['研究', '实验', '数据', '分析', '算法', '模型', '测试', '结果'],
  education: ['学习', '教学', '课程', '知识', '学生', '老师', '课程', '作业'],
  health: ['健康', '医疗', '药物', '疾病', '治疗', '预防', '护理', '康复'],
  finance: ['金融', '投资', '理财', '股票', '基金', '银行', '保险', '信贷'],
  entertainment: ['游戏', '电影', '音乐', '视频', '娱乐', '休闲', '活动', '比赛'],
};

// 中文分词（简单实现）
const tokenizeChinese = (text: string): string[] => {
  // 移除标点符号和空格
  const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');

  // 按字符分割（简单方法）
  const tokens = cleanText.split(/\s+/).filter(token => token.length > 0);

  // 过滤停用词
  return tokens.filter(token => !STOP_WORDS.includes(token));
};

// 计算TF-IDF权重
const calculateTFIDF = (tokens: string[], documentFrequency: Map<string, number> = new Map()) => {
  const termFrequency: Map<string, number> = new Map();

  // 计算词频 (TF)
  tokens.forEach(token => {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
  });

  // 计算TF-IDF
  const tfidfScores: Map<string, number> = new Map();
  const totalTokens = tokens.length;

  termFrequency.forEach((termFreq, term) => {
    const df = documentFrequency.get(term) ?? 1;
    const tf = termFreq / totalTokens;
    const idf = Math.log(1 + (1 / df));
    tfidfScores.set(term, tf * idf);
  });

  return tfidfScores;
};

// 提取命名实体（简单实现）
const extractNamedEntities = (text: string): string[] => {
  const entities: string[] = [];

  // 匹配常见的中文命名实体模式
  const patterns = [
    // 公司名称（包含"公司"、"科技"、"集团"等）
    /([^，。！？\s]+)(?:公司|科技|集团|网络|技术|系统|平台|服务|解决方案)/g,
    // 产品名称
    /([^，。！？\s]+)(?:手机|电脑|软件|应用|游戏|电影|书籍|课程)/g,
    // 地名
    /([^，。！？\s]+)(?:北京|上海|广州|深圳|杭州|成都|武汉)/g,
    // 专业术语
    /([^，。！？\s]+)(?:人工智能|机器学习|区块链|云计算|大数据)/g,
  ];

  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches && matches.length > 1) {
      entities.push(...matches.slice(1)); // 排除完整匹配
    }
  });

  return entities;
};

// 提取问题关键词
const extractQuestionKeywords = (text: string): string[] => {
  const questionPatterns = [
    /(?:什么是|怎么|如何|为什么|哪里|哪个|谁)([^，。！？\n]+)/g,
    /(?:帮我|请问|请|想|需要)([^，。！？\n]+)/g,
    /(?:关于|对于|针对)([^，。！？\n]+)/g,
  ];

  const keywords: string[] = [];

  questionPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches && matches[1]) {
      keywords.push(matches[1].trim());
    }
  });

  return keywords;
};

// 提取主题概念
const extractTopics = (text: string): string[] => {
  const topics: string[] = [];

  // 检查是否包含已知领域关键词
  Object.values(DOMAIN_KEYWORDS).forEach(keywords => {
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        topics.push(keyword);
      }
    });
  });

  return topics;
};

// 生成标题候选
const generateTitleCandidates = (
  messages: ChatMessage[],
  maxLength: number = 30,
): Array<{ title: string; score: number; strategy: string }> => {
  const candidates: Array<{ title: string; score: number; strategy: string }> = [];

  // 提取首条用户消息
  const firstUserMessage = messages.find(m => m.HUMAN);
  if (!firstUserMessage?.HUMAN) {
    return [{ title: '新对话', score: 0.1, strategy: 'default' }];
  }

  const text = firstUserMessage.HUMAN;

  // 策略1：基于关键词提取
  const tokens = tokenizeChinese(text);
  const tfidfScores = calculateTFIDF(tokens);

  if (tfidfScores.size > 0) {
    // 按权重排序，选择top 3
    const topKeywords = Array.from(tfidfScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([term]) => term);

    const keywordTitle = topKeywords.join('、');
    if (keywordTitle.length > 0 && keywordTitle.length <= maxLength) {
      candidates.push({
        title: keywordTitle,
        score: 0.9,
        strategy: 'keywords',
      });
    }
  }

  // 策略2：基于命名实体
  const entities = extractNamedEntities(text);
  if (entities.length > 0) {
    const entityTitle = entities.slice(0, 2).join('、');
    if (entityTitle.length <= maxLength) {
      candidates.push({
        title: entityTitle,
        score: 0.8,
        strategy: 'entities',
      });
    }
  }

  // 策略3：基于问题关键词
  const questionKeywords = extractQuestionKeywords(text);
  if (questionKeywords.length > 0) {
    const questionTitle = questionKeywords[0];
    if (questionTitle && questionTitle.length <= maxLength) {
      candidates.push({
        title: questionTitle,
        score: 0.7,
        strategy: 'questions',
      });
    }
  }

  // 策略4：基于主题概念
  const topics = extractTopics(text);
  if (topics.length > 0) {
    const topicTitle = topics[0];
    if (topicTitle && topicTitle.length <= maxLength) {
      candidates.push({
        title: `关于${topicTitle}`,
        score: 0.6,
        strategy: 'topics',
      });
    }
  }

  // 策略5：基于内容长度和复杂度
  if (text.length <= 10) {
    candidates.push({
      title: text,
      score: 0.5,
      strategy: 'short',
    });
  } else if (text.length <= maxLength) {
    candidates.push({
      title: text,
      score: 0.4,
      strategy: 'direct',
    });
  } else {
    // 长文本截断
    const truncated = text.substring(0, maxLength - 1) + '...';
    candidates.push({
      title: truncated,
      score: 0.3,
      strategy: 'truncated',
    });
  }

  return candidates;
};

// 选择最佳标题
const selectBestTitle = (candidates: Array<{ title: string; score: number; strategy: string }>): string => {
  if (candidates.length === 0) {
    return '新对话';
  }

  // 按分数排序，选择最高分的
  candidates.sort((a, b) => b.score - a.score);

  return candidates[0]!.title;
};

// 优化标题长度
const optimizeTitleLength = (title: string, maxLength: number = 30): string => {
  if (title.length <= maxLength) {
    return title;
  }

  // 尝试保留完整词语
  const truncated = title.substring(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '...';
  }

  // 如果没有空格，直接截断
  return truncated + '...';
};

// 智能标题生成主函数
export const generateSmartTitle = (
  messages: ChatMessage[],
  maxLength: number = 30,
): string => {
  if (!messages || messages.length === 0) {
    return '新对话';
  }

  // 如果已有非默认标题，直接返回
  // 注意：这个逻辑在实际使用中可能需要调整，因为ChatMessage接口没有sessionTitle属性
  // 这部分代码主要用于演示，实际应该通过外部传入当前标题
  // const existingSessionTitle = messages[0]?.sessionTitle;
  // if (existingSessionTitle && existingSessionTitle !== '新对话') {
  //   return existingSessionTitle;
  // }

  try {
    const candidates = generateTitleCandidates(messages, maxLength);
    const bestTitle = selectBestTitle(candidates);
    const optimizedTitle = optimizeTitleLength(bestTitle, maxLength);

    return optimizedTitle;
  } catch (error) {
    console.error('标题生成失败:', error);

    // 回退到简单截断
    const firstUserMessage = messages.find(m => m.HUMAN);
    if (firstUserMessage?.HUMAN) {
      return optimizeTitleLength(firstUserMessage.HUMAN, maxLength);
    }

    return '新对话';
  }
};

// 批量生成标题（用于多个会话）
export const generateTitlesBatch = (
  sessionsList: Array<{ messages: ChatMessage[]; id: string }>,
  maxLength: number = 30,
): Map<string, string> => {
  const titles = new Map<string, string>();

  sessionsList.forEach(session => {
    const title = generateSmartTitle(session.messages, maxLength);
    titles.set(session.id, title);
  });

  return titles;
};

// 更新会话标题（仅当需要时）
export const updateSessionTitleIfNeeded = (
  messages: ChatMessage[],
  currentTitle: string,
  maxLength: number = 30,
): { shouldUpdate: boolean; newTitle: string } => {
  const newTitle = generateSmartTitle(messages, maxLength);

  // 如果标题相同或新标题质量不高，则不更新
  if (newTitle === currentTitle || newTitle === '新对话') {
    return { shouldUpdate: false, newTitle: currentTitle };
  }

  // 计算标题质量评分
  const currentScore = calculateTitleScore(currentTitle);
  const newScore = calculateTitleScore(newTitle);

  // 只有新标题质量显著提升时才更新
  if (newScore > currentScore + 0.2) {
    return { shouldUpdate: true, newTitle };
  }

  return { shouldUpdate: false, newTitle: currentTitle };
};

// 计算标题质量评分
const calculateTitleScore = (title: string): number => {
  let score = 0.5; // 基础分数

  // 长度适中性（10-30字符最佳）
  if (title.length >= 10 && title.length <= 30) {
    score += 0.2;
  } else if (title.length > 30) {
    score -= 0.1;
  }

  // 包含关键词加分
  const hasKeywords = Object.values(DOMAIN_KEYWORDS).some(keywords =>
    keywords.some(keyword => title.includes(keyword)),
  );
  if (hasKeywords) {
    score += 0.2;
  }

  // 包含问号表示是问题，降低评分
  if (title.includes('？') || title.includes('怎么') || title.includes('如何')) {
    score -= 0.1;
  }

  // 避免通用词语
  const genericWords = ['新对话', '聊天', '对话', '讨论'];
  if (genericWords.includes(title)) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
};

// 导出工具函数供测试使用
export const titleGenerationUtils = {
  tokenizeChinese,
  calculateTFIDF,
  extractNamedEntities,
  extractQuestionKeywords,
  extractTopics,
  generateTitleCandidates,
  selectBestTitle,
  calculateTitleScore,
};