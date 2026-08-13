import type { IAbapConnection, IAdtResponse, IExecutor, ILogger } from '@mcp-abap-adt/interfaces';
import { type IProfilerTraceParameters } from '../../runtime/traces/profiler';
export interface IClassExecutionTarget {
    className: string;
}
export interface IClassExecuteWithProfilerOptions {
    profilerId: string;
}
export interface IClassExecuteWithProfilingOptions {
    profilerParameters?: IProfilerTraceParameters;
    traceLookupUris?: string[];
    /** Maximum number of polling attempts to find the trace (default: 5) */
    maxTraceAttempts?: number;
    /** Delay in ms between polling attempts (default: 2000) */
    traceRetryDelayMs?: number;
}
export interface IClassExecuteWithProfilingResult {
    response: IAdtResponse;
    profilerId: string;
    traceId: string;
    traceRequestsResponse: IAdtResponse;
}
export interface IClassExecutor extends IExecutor<IClassExecutionTarget, IAdtResponse, IClassExecuteWithProfilerOptions, IClassExecuteWithProfilingOptions, IClassExecuteWithProfilingResult> {
}
export declare class ClassExecutor implements IClassExecutor {
    private readonly connection;
    private readonly logger?;
    constructor(connection: IAbapConnection, logger?: ILogger);
    run(target: IClassExecutionTarget): Promise<IAdtResponse>;
    runWithProfiler(target: IClassExecutionTarget, options: IClassExecuteWithProfilerOptions): Promise<IAdtResponse>;
    runWithProfiling(target: IClassExecutionTarget, options?: IClassExecuteWithProfilingOptions): Promise<IClassExecuteWithProfilingResult>;
    /**
     * Single attempt to find trace via trace files (filtered by user),
     * URI lookup, and trace requests fallback.
     */
    private tryResolveTrace;
    private runWithProfilerId;
}
//# sourceMappingURL=ClassExecutor.d.ts.map