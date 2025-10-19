import type { ConversationAnalyticsFilters } from '@/types';
import { formatDateInputValue } from './formatDateInputValue';

export function getDefaultConversationFilters(): ConversationAnalyticsFilters {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: formatDateInputValue(startOfMonth),
    endDate: formatDateInputValue(now),
    agentId: 'all',
  };
}

export default getDefaultConversationFilters;