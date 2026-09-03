import { type ToolDeps } from './common.js';
/** The minimal shape the facade needs from a registered tool. */
export interface RoutableTool {
    name: string;
    /** `never` parameters: accepts every concrete tool signature (contravariance). */
    execute: (args: never, exec: never) => Promise<unknown>;
}
export declare function crudTools(deps: ToolDeps, tools: Map<string, RoutableTool>): import("../tooldef.js").DefinedTool[];
//# sourceMappingURL=crud.d.ts.map