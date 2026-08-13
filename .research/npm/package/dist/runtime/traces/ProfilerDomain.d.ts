import type { IAbapConnection, IAdtResponse, ILogger, IProfiler, IProfilerListOptions, IProfilerTraceDbAccessesOptions, IProfilerTraceHitListOptions, IProfilerTraceParameters, IProfilerTraceStatementsOptions } from '@mcp-abap-adt/interfaces';
export declare class Profiler implements IProfiler {
    private readonly connection;
    private readonly logger;
    readonly kind: "profiler";
    constructor(connection: IAbapConnection, logger: ILogger);
    list(options?: IProfilerListOptions): Promise<IAdtResponse>;
    /** @deprecated Use list() instead */
    listTraceFiles(options?: IProfilerListOptions): Promise<IAdtResponse>;
    getParameters(): Promise<IAdtResponse>;
    getParametersForCallstack(): Promise<IAdtResponse>;
    getParametersForAmdp(): Promise<IAdtResponse>;
    buildParametersXml(options?: IProfilerTraceParameters): string;
    createParameters(options?: IProfilerTraceParameters): Promise<IAdtResponse>;
    extractIdFromResponse(response: IAdtResponse): string | undefined;
    getDefaultParameters(): Omit<IProfilerTraceParameters, 'description'>;
    getHitList(traceIdOrUri: string, options?: IProfilerTraceHitListOptions): Promise<IAdtResponse>;
    getStatements(traceIdOrUri: string, options?: IProfilerTraceStatementsOptions): Promise<IAdtResponse>;
    getDbAccesses(traceIdOrUri: string, options?: IProfilerTraceDbAccessesOptions): Promise<IAdtResponse>;
    listRequests(): Promise<IAdtResponse>;
    getRequestsByUri(uri: string): Promise<IAdtResponse>;
    listObjectTypes(): Promise<IAdtResponse>;
    listProcessTypes(): Promise<IAdtResponse>;
}
//# sourceMappingURL=ProfilerDomain.d.ts.map