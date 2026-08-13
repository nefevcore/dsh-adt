import type { IBatchPayload, IBatchRequestPart } from './types';
export declare function createBatchBoundary(): string;
export declare function createRequestId(): string;
export declare function serializeParams(params: Record<string, string>): string;
export declare function buildInnerRequest(part: IBatchRequestPart): string;
export declare function buildBatchPayload(parts: IBatchRequestPart[], boundary?: string): IBatchPayload;
//# sourceMappingURL=buildBatchPayload.d.ts.map