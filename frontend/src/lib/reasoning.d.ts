import type { ParsedReasoningUpdate } from '@/types/dynamic';
export interface RawReasoningEvent {
    event?: string;
    data: unknown;
}
export declare const normalizeReasoningDisplay: (input: string) => {
    body: string;
    title?: string;
};
export declare const parseReasoningPayload: (payload: RawReasoningEvent | undefined | null) => ParsedReasoningUpdate | null;
export default parseReasoningPayload;
//# sourceMappingURL=reasoning.d.ts.map