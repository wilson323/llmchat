import { ReasoningStepUpdate } from '@/types';
import type {
  FastGPTReasoningData,
  ParsedReasoningUpdate,
} from '@/types/dynamic';

const isReasoningData = (value: unknown): value is FastGPTReasoningData => {
  return typeof value === 'object' &&
         value !== null &&
         !Array.isArray(value);
};

const toJsonValue = (value: unknown): unknown => {
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
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      result[key] = toJsonValue(val);
    });
    return result;
  }
  return String(value);
};

export interface RawReasoningEvent {
  event?: string;
  data: unknown;
}

const STEP_TITLE_REGEX = /^(?:步骤\s*\d+|Step\s*\d+|思考\s*\d+|阶段\s*\d+|环节\s*\d+|Task\s*\d+|第[\d一二三四五六七八九十百零两]+步|\d+[.、）])/i;

export const normalizeReasoningDisplay = (
  input: string,
): { body: string; title?: string } => {
  const sanitized = (input ?? '').replace(/\r\n/g, '\n').trim();
  if (!sanitized) {
    return { body: '' };
  }

  const lines = sanitized.split(/\n+/);
  const firstLine = lines[0]?.trim() ?? '';
  const restLines = lines.slice(1);

  let candidateTitle: string | null = null;
  let inlineRemainder = '';
  let matchedByPattern = false;

  const colonMatch = firstLine.match(/^(?<title>.+?)[：:]\s*(?<rest>.*)$/);
  if (colonMatch?.groups?.title) {
    candidateTitle = colonMatch.groups.title.trim();
    inlineRemainder = colonMatch.groups.rest.trim();
  } else {
    const patternMatch = firstLine.match(STEP_TITLE_REGEX);
    if (patternMatch) {
      candidateTitle = patternMatch[0].trim();
      inlineRemainder = firstLine.slice(patternMatch[0].length).trim();
      matchedByPattern = true;
    }
  }

  const restJoined = restLines.join('\n').trim();

  if (!candidateTitle) {
    return { body: sanitized };
  }

  const normalizedTitle = candidateTitle.replace(/\s+/g, ' ').trim();
  const effectiveRest = [inlineRemainder, restJoined]
    .filter((segment) => segment && segment.length > 0)
    .join('\n')
    .trim();

  const isShortTitle = normalizedTitle.length > 0 && normalizedTitle.length <= 24;
  const shouldUseTitle =
    (matchedByPattern && (effectiveRest.length > 0 || inlineRemainder.length > 0 || restJoined.length > 0)) ||
    (!matchedByPattern && colonMatch !== null && isShortTitle && effectiveRest.length > 0);

  if (!shouldUseTitle) {
    return { body: sanitized };
  }

  const body = effectiveRest || sanitized;

  return {
    body,
    title: normalizedTitle,
  };
};

const tryParseJson = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const firstNumber = (candidates: Array<unknown>): number | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const mergeTotalSteps = (current: number | undefined, next: number | undefined, fallback: () => number | undefined) => {
  if (typeof next === 'number' && Number.isFinite(next)) {
    return next;
  }
  if (typeof current === 'number') {
    return current;
  }
  return fallback();
};

export const parseReasoningPayload = (payload: RawReasoningEvent | undefined | null): ParsedReasoningUpdate | null => {
  if (payload?.data === null) {
    return null;
  }

  const queue: unknown[] = [payload.data];
  const steps: ReasoningStepUpdate[] = [];
  let finished = false;
  let totalSteps: number | undefined;

  const pushStep = (step: ReasoningStepUpdate) => {
    const normalized = normalizeText(step.content);
    if (!normalized) {
      return;
    }

    const mergedStep: ReasoningStepUpdate = {
      ...step,
      content: normalized,
    };

    steps.push(mergedStep);

    if (typeof mergedStep.totalSteps === 'number' && Number.isFinite(mergedStep.totalSteps)) {
      totalSteps = Math.max(totalSteps ?? 0, mergedStep.totalSteps);
    }
  };

  while (queue.length > 0) {
    const item = queue.shift();
    if (item === null) {
      continue;
    }

    if (typeof item === 'string') {
      const parsed = tryParseJson(item);
      if (parsed) {
        queue.push(parsed);
        continue;
      }
      pushStep({ content: item });
      continue;
    }

    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }

    if (typeof item === 'object' && item !== null) {
      // 使用类型守卫确保item是推理数据
      if (isReasoningData(item)) {
        const reasoningData = item;

        // 嵌套的常见字段
        if (reasoningData.data && reasoningData.data !== item) {
          queue.push(reasoningData.data);
        }
        if (reasoningData.payload && reasoningData.payload !== item) {
          queue.push(reasoningData.payload);
        }
        if (reasoningData.output?.reasoning_content) {
          queue.push(reasoningData.output.reasoning_content);
        }
        if (reasoningData.delta?.reasoning_content) {
          queue.push(reasoningData.delta.reasoning_content);
        }
        if (reasoningData.reasoning_content) {
          queue.push(reasoningData.reasoning_content);
        }
        if (reasoningData.reasoning) {
          queue.push(reasoningData.reasoning);
        }
        if (reasoningData.steps) {
          queue.push(reasoningData.steps);
        }

        // thought / analysis 信息
        const textFromTextField = normalizeText(reasoningData.text);
        if (textFromTextField) {
          const parsed = tryParseJson(textFromTextField);
          if (parsed) {
            queue.push(parsed);
          }

          const orderFromText = firstNumber([
            reasoningData.thoughtNumber,
            reasoningData.step,
            reasoningData.index,
            reasoningData.order,
            reasoningData.stepNumber,
          ]);

          const totalFromText = firstNumber([
            reasoningData.totalThoughts,
            reasoningData.total_steps,
            reasoningData.totalSteps,
          ]);

          pushStep({
            content: textFromTextField,
            order: orderFromText,
            totalSteps: totalFromText,
            raw: toJsonValue(item),
          });
        }

        const candidate = normalizeText(
          reasoningData.thought ??
          reasoningData.content ??
          reasoningData.message ??
          reasoningData.analysis ??
          reasoningData.reasoning ??
          reasoningData.details,
        );

        if (candidate) {
          const order = firstNumber([
            reasoningData.order,
            reasoningData.step,
            reasoningData.stepIndex,
            reasoningData.index,
            reasoningData.thoughtNumber,
          ]);

          const total = firstNumber([
            reasoningData.totalThoughts,
            reasoningData.totalSteps,
            reasoningData.total_steps,
          ]);

          const title = normalizeText(reasoningData.title) ?? undefined;

          pushStep({
            content: candidate,
            order,
            totalSteps: total,
            title,
            raw: toJsonValue(item),
          });
        }

        const totalCandidate = firstNumber([
          reasoningData.totalThoughts,
          reasoningData.totalSteps,
          reasoningData.total_steps,
        ]);
        if (typeof totalCandidate === 'number' && Number.isFinite(totalCandidate)) {
          totalSteps = Math.max(totalSteps ?? 0, totalCandidate);
        }

        // 检查完成标志
        if (
          reasoningData.nextThoughtNeeded === false ||
          reasoningData.need_next_thought === false ||
          reasoningData.hasMore === false ||
          reasoningData.has_more === false ||
          reasoningData.finished === true ||
          reasoningData.is_final === true ||
          reasoningData.isFinal === true ||
          reasoningData.done === true ||
          reasoningData.completed === true
        ) {
          finished = true;
        }
      } else {
        // 对于无法识别的对象，尝试提取基本文本信息
        const obj = item as Record<string, unknown>;

        // 安全地提取文本候选值
        const textCandidates = [
          typeof obj.thought === 'string' ? obj.thought : null,
          typeof obj.content === 'string' ? obj.content : null,
          typeof obj.message === 'string' ? obj.message : null,
          typeof obj.analysis === 'string' ? obj.analysis : null,
          typeof obj.reasoning === 'string' ? obj.reasoning : null,
          typeof obj.details === 'string' ? obj.details : null,
        ].filter((candidate): candidate is string => candidate !== null);

        const candidate = normalizeText(textCandidates[0] || '');

        if (candidate) {
          const order = firstNumber([
            obj.order,
            obj.step,
            obj.stepIndex,
            obj.index,
            obj.thoughtNumber,
          ]);

          const total = firstNumber([
            obj.totalThoughts,
            obj.totalSteps,
            obj.total_steps,
          ]);

          const title = normalizeText(
            typeof obj.title === 'string' ? obj.title : undefined,
          ) ?? undefined;

          pushStep({
            content: candidate,
            order,
            totalSteps: total,
            title,
            raw: toJsonValue(item),
          });
        }
      }
    }
  }

  if (!finished && payload.event && /end|finish|complete|done/i.test(payload.event)) {
    finished = true;
  }

  if (steps.length === 0 && !finished) {
    return null;
  }

  totalSteps = mergeTotalSteps(totalSteps, undefined, () => {
    const maxOrder = steps.reduce((max, step) => {
      if (typeof step.order === 'number' && Number.isFinite(step.order)) {
        return Math.max(max, step.order);
      }
      return max;
    }, 0);
    return maxOrder > 0 ? maxOrder : undefined;
  });

  return {
    steps,
    finished,
    totalSteps,
  };
};

export default parseReasoningPayload;
