;
import { FastGPTEvent } from '@/types';
import { getNormalizedEventKey, isReasoningEvent, isChunkLikeEvent } from './fastgptEvents';
import type {
  JsonObject,
  JsonValue,
} from '@/types/dynamic';

// 简化的类型守卫函数
const isString = (value: unknown): value is string => typeof value === 'string';

// 安全的 JsonValue 属性访问工具
const safeGetProperty = (obj: JsonValue | undefined, key: string): JsonValue | undefined => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return undefined;
  }
  return (obj as Record<string, JsonValue>)[key];
};

const safeGetObject = (obj: JsonValue | undefined, key: string): JsonValue | undefined => {
  const value = safeGetProperty(obj, key);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value;
};

const safeGetArray = (obj: JsonValue | undefined, key: string): JsonValue[] | undefined => {
  const value = safeGetProperty(obj, key);
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value;
};

const toJsonValue = (value: unknown): JsonValue => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }
  if (typeof value === 'object') {
    const result: { [key: string]: JsonValue } = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      result[key] = toJsonValue(val);
    });
    return result as JsonValue;
  }
  return String(value);
};

const truncateText = (value: string, max = 80): string => {
  if (typeof value !== 'string' || max <= 0) {
    return '';
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
};

const safeJsonParse = <T extends JsonValue = JsonValue>(input: unknown): T | null => {
  if (typeof input !== 'string') {
    return null;
  }
  const attempts = [input];
  const trimmed = input.trim();
  if (trimmed !== input) {
    attempts.push(trimmed);
  }

  if (trimmed.endsWith(',')) {
    attempts.push(trimmed.slice(0, -1));
  }

  if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
    attempts.push(`${trimmed}}`);
  }

  if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
    attempts.push(`${trimmed}]`);
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      continue;
    }
  }
  return null;
};

interface ToolEventState {
  id: string;
  paramsChunks: string[];
  toolName?: string;
  functionName?: string;
}

const toolEventStates = new Map<string, ToolEventState>();

const getToolState = (toolId: string): ToolEventState => {
  let state = toolEventStates.get(toolId);
  if (!state) {
    state = { id: toolId, paramsChunks: [] };
    toolEventStates.set(toolId, state);
  }
  return state;
};

const TOOL_START_EVENTS = new Set<string>([
  'tool',
  'toolcall',
  'plugincall',
  'plugin',
]);

const TOOL_UPDATE_EVENTS = new Set<string>([
  'toolparams',
]);

const TOOL_COMPLETE_EVENTS = new Set<string>([
  'toolresponse',
  'toolresult',
  'toolend',
  'toolcomplete',
  'toolfinish',
]);

interface ToolParamsInfo {
  raw: string | undefined;
  parsed: JsonObject | null;
  summary: string | undefined;
  detail: string | undefined;
}

const collectToolParamsInfo = (state: ToolEventState): ToolParamsInfo => {
  if (!state.paramsChunks.length) {
    return {
      raw: undefined,
      parsed: null,
      summary: undefined,
      detail: undefined,
    };
  }

  const raw = state.paramsChunks.join('').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return { raw: undefined, parsed: null, summary: undefined, detail: undefined };
  }

  const parsed = safeJsonParse<JsonValue>(raw);

  const convertToJsonObject = (obj: JsonValue | null): JsonObject | null => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return null;
    }

    const result: { [key: string]: JsonValue } = {};
    Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
      result[key] = toJsonValue(value);
    });
    return result as JsonObject;
  };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      raw,
      parsed: null,
      summary: truncateText(raw, 60),
      detail: undefined,
    };
  }

  const entries = Object.entries(parsed);
  const primaryEntry = entries.find(([key]) => ['ques', 'query', 'question', 'input', 'prompt', 'keywords', 'text'].includes(key));

  const summaryParts: string[] = [];
  if (primaryEntry && typeof primaryEntry[1] === 'string') {
    summaryParts.push(`查询「${truncateText(primaryEntry[1], 24)}」`);
  }

  const otherEntries = entries.filter(([key]) => key !== (primaryEntry?.[0] ?? ''));
  if (otherEntries.length > 0) {
    const extras = otherEntries
      .map(([key, value]) => `${key}=${truncateText(String(value), 16)}`)
      .join('，');
    if (extras) {
      summaryParts.push(extras);
    }
  }

  const detail = otherEntries.length > 0
    ? otherEntries
      .map(([key, value]) => `${key}：${typeof value === 'string' ? truncateText(value, 40) : truncateText(JSON.stringify(value), 40)}`)
      .join('\n')
    : undefined;

  return {
    raw,
    parsed: convertToJsonObject(parsed),
    summary: summaryParts.length > 0 ? summaryParts.join(' ｜ ') : truncateText(raw, 60),
    detail,
  };
};

const extractDatasetFromTextBlocks = (texts: string[]) => {
  for (const text of texts) {
    const parsed = safeJsonParse<JsonValue>(text);
    if (!parsed || typeof parsed !== 'object') {
      continue;
    }

    const list = Array.isArray(safeGetProperty(parsed, 'data'))
      ? safeGetProperty(parsed, 'data')
      : Array.isArray(safeGetProperty(parsed, 'list'))
        ? safeGetProperty(parsed, 'list')
        : Array.isArray(safeGetProperty(parsed, 'records'))
          ? safeGetProperty(parsed, 'records')
          : null;

    if (list && Array.isArray(list)) {
      return { items: list, raw: parsed };
    }
  }
  return null;
};

interface ToolResponseInfo {
  summary: string | undefined;
  detail: string | undefined;
  payload: JsonValue | undefined;
  isError: boolean;
}

const buildToolResponseInfo = (response: unknown): ToolResponseInfo => {
  if (!response) {
    return {
      summary: undefined,
      detail: undefined,
      payload: undefined,
      isError: false,
    };
  }

  const rawString = typeof response === 'string'
    ? response.replace(/\s+/g, ' ').trim()
    : undefined;

  const parsedResponse = typeof response === 'string'
    ? safeJsonParse<JsonValue>(response) ?? toJsonValue(response)
    : toJsonValue(response);

  if (!parsedResponse || typeof parsedResponse !== 'object' || Array.isArray(parsedResponse)) {
    return {
      summary: rawString ? truncateText(rawString, 100) : undefined,
      detail: undefined,
      payload: toJsonValue(rawString),
      isError: false,
    };
  }

  const responseObj = parsedResponse as Record<string, unknown>;
  if (responseObj.isError) {
    return {
      summary: isString(responseObj.errorMessage)
        ? responseObj.errorMessage
        : isString(responseObj.message)
          ? responseObj.message
          : '工具调用失败',
      detail: isString(responseObj.stack) ? responseObj.stack : undefined,
      payload: toJsonValue(responseObj),
      isError: true,
    };
  }

  const textBlocks = Array.isArray(responseObj.content)
    ? responseObj.content
      .filter((block: unknown): block is { type: string; text: string } =>
        block !== null &&
          typeof block === 'object' &&
          (block as { type?: unknown }).type === 'text' &&
          typeof (block as { text?: unknown }).text === 'string',
      )
      .map((block: { type: string; text: string }) => block.text)
    : [];

  const dataset = extractDatasetFromTextBlocks(textBlocks);

  if (dataset) {
    const { items } = dataset;
    const count = items.length;
    const first = items[0] || {};
    const title = safeGetProperty(first, 'title') || safeGetProperty(first, 'name') || safeGetProperty(first, 'q') || safeGetProperty(first, 'question') || safeGetProperty(first, 'productName');
    const source = safeGetProperty(first, 'sourceName') || safeGetProperty(first, 'source') || safeGetProperty(first, 'datasetName');

    const summaryParts: string[] = [`命中 ${count} 条知识库内容`];
    if (title) {
      summaryParts.push(`示例：${truncateText(String(title), 24)}`);
    }
    if (source) {
      summaryParts.push(`来源：${truncateText(String(source), 24)}`);
    }

    const detail = items.slice(0, 3)
      .map((item: JsonValue, index: number) => {
        if (!item || typeof item !== 'object') {
          return `${index + 1}. 记录`;
        }
        const itemTitle = safeGetProperty(item, 'title') || safeGetProperty(item, 'name') || safeGetProperty(item, 'q') || safeGetProperty(item, 'question') || safeGetProperty(item, 'productName') || '记录';
        const itemSource = safeGetProperty(item, 'sourceName') || safeGetProperty(item, 'source') || safeGetProperty(item, 'datasetName');
        return `${index + 1}. ${truncateText(String(itemTitle), 40)}${itemSource ? `（${truncateText(String(itemSource), 20)}）` : ''}`;
      })
      .join('\n');

    return {
      summary: summaryParts.join(' · '),
      detail: detail || undefined,
      payload: {
        ...parsedResponse,
        datasetPreview: items.slice(0, 5),
      },
      isError: false,
    };
  }

  if (textBlocks.length > 0) {
    return {
      summary: truncateText(textBlocks[0]!.replace(/\s+/g, ' ').trim(), 100),
      detail: textBlocks.slice(1, 3).map((item: string) => truncateText(item.replace(/\s+/g, ' ').trim(), 80)).join('\n') || undefined,
      payload: parsedResponse,
      isError: false,
    };
  }

  const fallback = safeGetProperty(parsedResponse, 'result') ||
                   safeGetProperty(parsedResponse, 'message') ||
                   safeGetProperty(parsedResponse, 'summary');
  if (typeof fallback === 'string') {
    return {
      summary: truncateText(fallback.replace(/\s+/g, ' ').trim(), 100),
      detail: undefined,
      payload: parsedResponse,
      isError: false,
    };
  }

  return {
    summary: rawString ? truncateText(rawString, 100) : undefined,
    detail: undefined,
    payload: parsedResponse,
    isError: false,
  };
};

const normalizeToolEvent = (_eventName: string, normalizedKey: string, payload: JsonValue): FastGPTEvent | null => {
  const tool = safeGetObject(payload, 'tool');
  if (!tool || typeof safeGetProperty(tool, 'id') !== 'string') {
    return null;
  }

  const toolId = String(safeGetProperty(tool, 'id'));
  const state = getToolState(toolId);

  const toolName = safeGetProperty(tool, 'toolName');
  if (typeof toolName === 'string' && toolName.trim()) {
    state.toolName = toolName.trim();
  }

  const functionName = safeGetProperty(tool, 'functionName');
  if (typeof functionName === 'string' && functionName.trim()) {
    state.functionName = functionName.trim();
  }

  const params = safeGetProperty(tool, 'params');
  if (typeof params === 'string' && params.trim()) {
    state.paramsChunks.push(params);
  }

  const paramsInfo = collectToolParamsInfo(state);

  const labelCandidates = [state.toolName, state.functionName, '工具调用'].filter((value): value is string => !!value && value.trim().length > 0);
  const label = labelCandidates[0] ?? '工具调用';

  const basePayload: Record<string, JsonValue> = {
    toolId,
    toolName: state.toolName ?? null,
    functionName: state.functionName ?? null,
    params: paramsInfo.parsed ?? null,
    paramsRaw: paramsInfo.raw ?? null,
  };

  const baseEvent: FastGPTEvent = {
    type: 'tool',
    label,
    level: 'info',
    summary: paramsInfo.summary ?? '工具调用中',
    payload: basePayload,
    timestamp: String(Date.now()),
  };

  if (TOOL_START_EVENTS.has(normalizedKey)) {
    return {
      ...baseEvent,
      type: 'start',
      summary: paramsInfo.summary ? `调用中 · ${paramsInfo.summary}` : '工具调用中',
    };
  }

  if (TOOL_UPDATE_EVENTS.has(normalizedKey)) {
    if (paramsInfo.summary) {
      baseEvent.summary = `调用中 · ${paramsInfo.summary}`;
    }
    return baseEvent;
  }

  if (TOOL_COMPLETE_EVENTS.has(normalizedKey)) {
    const toolResponse = safeGetProperty(tool, 'response') ?? safeGetProperty(payload, 'response');
    const responseInfo = buildToolResponseInfo(toolResponse);
    return {
      type: 'complete',
      level: responseInfo.isError ? 'error' : 'success',
      label: baseEvent.label,
      summary: responseInfo.summary ?? (responseInfo.isError ? '工具调用失败' : '工具调用完成'),
      payload: {
        ...basePayload,
        response: responseInfo.payload ?? null,
        ...(typeof toolResponse === 'string' && {
          rawResponsePreview: truncateText(toolResponse.replace(/\s+/g, ' ').trim(), 400)
        }),
      } as JsonValue,
      timestamp: String(Date.now()),
    };
  }

  return baseEvent;
};

const datasetSummary = (payload: JsonValue): string | undefined => {
  const dataSource = safeGetArray(payload, 'data') ?? safeGetArray(payload, 'list') ?? (Array.isArray(payload) ? payload : undefined);
  const items: JsonValue[] = dataSource ?? safeGetArray(payload, 'records') ?? safeGetArray(payload, 'citations') ?? [];

  if (items.length === 0 && typeof payload === 'string') {
    return payload.slice(0, 80);
  }

  const titles = items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return undefined;
      }
      return safeGetProperty(item, 'title') || safeGetProperty(item, 'name') || safeGetProperty(item, 'source') || safeGetProperty(item, 'datasetName');
    })
    .filter((title): title is string => typeof title === 'string' && title.trim().length > 0)
    .slice(0, 3);

  if (titles.length > 0) {
    const joined = titles.join('、');
    return `引用：${joined}${items.length > titles.length ? ` 等 ${items.length} 条` : ''}`;
  }

  return items.length > 0 ? `引用 ${items.length} 条知识库内容` : undefined;
};

const summarySummary = (payload: JsonValue): string | undefined => {
  const candidate = safeGetProperty(payload, 'content')
    ?? safeGetProperty(payload, 'summary')
    ?? safeGetProperty(payload, 'text')
    ?? safeGetProperty(payload, 'message')
    ?? safeGetProperty(payload, 'result');

  if (typeof candidate === 'string') {
    return candidate.trim().slice(0, 120);
  }

  return undefined;
};

const toolSummary = (payload: JsonValue): string | undefined => {
  const name = safeGetProperty(payload, 'toolName') || safeGetProperty(payload, 'name') || safeGetProperty(payload, 'pluginName');
  const action = safeGetProperty(payload, 'action') || safeGetProperty(payload, 'method') || safeGetProperty(payload, 'type');
  const description = safeGetProperty(payload, 'description') || safeGetProperty(payload, 'result') || safeGetProperty(payload, 'output') || safeGetProperty(payload, 'message');

  const parts = [
    typeof name === 'string' ? name : null,
    typeof action === 'string' ? action : null,
  ].filter(Boolean) as string[];

  const head = parts.join(' · ');
  if (head && typeof description === 'string') {
    return `${head}：${description.slice(0, 80)}`;
  }

  if (head) {
    return head;
  }
  if (typeof description === 'string') {
    return description.slice(0, 80);
  }

  return undefined;
};

const usageSummary = (payload: JsonValue): string | undefined => {
  const usage = safeGetObject(payload, 'usage') ?? payload;
  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  const prompt = safeGetProperty(usage, 'prompt_tokens') ?? safeGetProperty(usage, 'promptTokens');
  const completion = safeGetProperty(usage, 'completion_tokens') ?? safeGetProperty(usage, 'completionTokens');
  const total = safeGetProperty(usage, 'total_tokens') ?? safeGetProperty(usage, 'totalTokens');

  const parts: string[] = [];
  if (typeof prompt === 'number') {
    parts.push(`提示 ${prompt}`);
  }
  if (typeof completion === 'number') {
    parts.push(`生成 ${completion}`);
  }
  if (typeof total === 'number') {
    parts.push(`总计 ${total}`);
  }

  if (parts.length > 0) {
    return `Token 用量：${parts.join(' / ')}`;
  }

  return undefined;
};

const fallbackSummary = (payload: JsonValue): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : undefined;
  }

  const candidate = safeGetProperty(payload, 'content')
    ?? safeGetProperty(payload, 'text')
    ?? safeGetProperty(payload, 'message')
    ?? safeGetProperty(payload, 'detail')
    ?? safeGetProperty(payload, 'description');

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : undefined;
  }

  if (typeof payload === 'object' && payload) {
    try {
      const json = JSON.stringify(payload);
      return json.length > 0 ? json.slice(0, 120) : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const EVENT_METADATA_ENTRIES: Array<[string, { label: string; level: FastGPTEvent['level']; summary?: (payload: JsonValue) => string | undefined }]> = [
  ['datasetQuote', { label: '知识库引用', level: 'info', summary: datasetSummary }],
  ['datasetCite', { label: '知识库引用', level: 'info', summary: datasetSummary }],
  ['dataset', { label: '知识库引用', level: 'info', summary: datasetSummary }],
  ['quote', { label: '引用内容', level: 'info', summary: datasetSummary }],
  ['citation', { label: '引用内容', level: 'info', summary: datasetSummary }],
  ['citations', { label: '引用内容', level: 'info', summary: datasetSummary }],
  ['references', { label: '参考资料', level: 'info', summary: datasetSummary }],
  ['reference', { label: '参考资料', level: 'info', summary: datasetSummary }],
  ['answer_summary', { label: '答案总结', level: 'success', summary: summarySummary }],
  ['summary', { label: '总结', level: 'success', summary: summarySummary }],
  ['final_summary', { label: '最终总结', level: 'success', summary: summarySummary }],
  ['tool', { label: '工具调用', level: 'info', summary: toolSummary }],
  ['tool_call', { label: '工具调用', level: 'info', summary: toolSummary }],
  ['tool_end', { label: '工具结束', level: 'success', summary: toolSummary }],
  ['toolResult', { label: '工具结果', level: 'success', summary: toolSummary }],
  ['tool_result', { label: '工具结果', level: 'success', summary: toolSummary }],
  ['plugin_call', { label: '插件调用', level: 'info', summary: toolSummary }],
  ['usage', { label: 'Token 用量', level: 'info', summary: usageSummary }],
  ['flowResponses', { label: '流程执行完成', level: 'success', summary: summarySummary }],
  // 友好映射：工作流耗时/开始/结束
  ['workflowDuration', { label: '工作流耗时', level: 'success', summary: (payload: JsonValue) => {
    const seconds = typeof payload === 'number' ? payload : (safeGetProperty(payload, 'durationSeconds') ?? safeGetProperty(payload, 'seconds') ?? safeGetProperty(payload, 'duration'));
    if (typeof seconds === 'number' && isFinite(seconds)) {
      const s = Math.round(seconds * 100) / 100;
      const mins = Math.floor(s / 60);
      const rem = Math.round((s - mins * 60) * 100) / 100;
      return mins > 0 ? `总耗时：${mins}分${rem}秒` : `总耗时：${s}秒`;
    }
    return fallbackSummary(payload);
  } }],
  ['start', { label: '开始', level: 'info', summary: (payload: JsonValue) => {
    const id = safeGetProperty(payload, 'id') ?? safeGetProperty(payload, 'requestId');
    const agent = safeGetProperty(payload, 'agentId') ?? safeGetProperty(payload, 'appId');
    return [id ? `请求ID：${truncateText(String(id), 24)}` : undefined, agent ? `Agent：${truncateText(String(agent), 24)}` : undefined]
      .filter(Boolean)
      .join('，') || fallbackSummary(payload);
  } }],
  ['end', { label: '结束', level: 'success', summary: (payload: JsonValue) => fallbackSummary(payload) }],
];

const EVENT_METADATA: Record<string, { label: string; level: FastGPTEvent['level']; summary?: (payload: JsonValue) => string | undefined }> =
  EVENT_METADATA_ENTRIES.reduce((acc, [name, meta]) => {
    acc[getNormalizedEventKey(name)] = meta;
    return acc;
  }, {} as Record<string, { label: string; level: FastGPTEvent['level']; summary?: (payload: JsonValue) => string | undefined }>);

const IGNORED_EVENTS = new Set(
  [
    'chunk',
    'message',
    'answer',
    'status',
    'flowNodeStatus',
    'interactive',
    'chatId',
    'start',
    'end',
    'dataset',
    'quote',
    'citation',
    'citations',
    'references',
    'reference',
    'summary',
    'final_summary',
    'answer_summary',
    'usage',
  ]
    .map((name) => getNormalizedEventKey(name))
    .concat(getNormalizedEventKey('reasoning')),
);

// const generateEventId = (key: string) => `${key}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const normalizeFastGPTEvent = (eventName: string, payload: JsonValue): FastGPTEvent | null => {
  if (!eventName) {
    return null;
  }
  const key = getNormalizedEventKey(eventName);

  const toolEvent = normalizeToolEvent(eventName, key, payload);
  if (toolEvent) {
    return toolEvent;
  }

  if (IGNORED_EVENTS.has(key) || isReasoningEvent(eventName) || isChunkLikeEvent(eventName)) {
    return null;
  }

  const metadata = EVENT_METADATA[key];
  const label = metadata?.label ?? `事件：${eventName}`;
  const level = metadata?.level ?? 'info';
  const summary = metadata?.summary?.(payload) ?? fallbackSummary(payload);

  if (!metadata && !summary) {
    // 未知事件且无法提取摘要时不冗余展示
    return null;
  }

  return {
    type: key as any, // 临时类型转换，因为 FastGPTStreamEventType 可能不包含所有事件类型
    label,
    ...(summary && { summary }),
    payload,
    timestamp: String(Date.now()),
    level,
  };
};

export default normalizeFastGPTEvent;
