import type { IAbapConnection, IAdtResponse, IExecutor, ILogger } from '@mcp-abap-adt/interfaces';
import { type IProfilerTraceParameters } from '../../runtime/traces/profiler';
export interface IProgramExecutionTarget {
    programName: string;
}
export interface IProgramExecuteWithProfilerOptions {
    profilerId: string;
}
export interface IProgramExecuteWithProfilingOptions {
    profilerParameters?: IProfilerTraceParameters;
}
export interface IProgramExecuteWithProfilingResult {
    response: IAdtResponse;
    profilerId: string;
}
export interface IProgramExecutor extends IExecutor<IProgramExecutionTarget, IAdtResponse, IProgramExecuteWithProfilerOptions, IProgramExecuteWithProfilingOptions, IProgramExecuteWithProfilingResult> {
}
export declare class ProgramExecutor implements IProgramExecutor {
    private readonly connection;
    constructor(connection: IAbapConnection, _logger?: ILogger);
    run(target: IProgramExecutionTarget): Promise<IAdtResponse>;
    runWithProfiler(target: IProgramExecutionTarget, options: IProgramExecuteWithProfilerOptions): Promise<IAdtResponse>;
    runWithProfiling(target: IProgramExecutionTarget, options?: IProgramExecuteWithProfilingOptions): Promise<IProgramExecuteWithProfilingResult>;
    private runWithProfilerId;
}
//# sourceMappingURL=ProgramExecutor.d.ts.map