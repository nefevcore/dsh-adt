import type { ToolResultView } from '@deepseek-ai/dsh-tools';
import { type ToolDeps } from './common.js';
/** Project an adt_search value into search-card metadata (see presentation.d.ts). */
export declare function searchPresentationMeta(value: {
    query: string;
    count: number;
    objects: Array<{
        objectName: string;
        type: string;
        uri: string;
    }>;
    sources: Array<{
        objectName: string;
        type: string;
        uri: string;
        line: string;
        lineNumber?: number;
    }>;
}): ToolResultView | undefined;
export declare function searchTools(deps: ToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition[];
//# sourceMappingURL=search.d.ts.map