/**
 * ABAP Profiler Traces
 *
 * Provides functions for managing and retrieving ABAP profiler traces:
 * - Trace files listing
 * - Trace parameters (general, callstack aggregation, AMDP)
 * - Trace requests
 * - Object types and process types
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export interface IProfilerTraceParameters {
    allMiscAbapStatements?: boolean;
    allProceduralUnits?: boolean;
    allInternalTableEvents?: boolean;
    allDynproEvents?: boolean;
    description?: string;
    aggregate?: boolean;
    explicitOnOff?: boolean;
    withRfcTracing?: boolean;
    allSystemKernelEvents?: boolean;
    sqlTrace?: boolean;
    allDbEvents?: boolean;
    maxSizeForTraceFile?: number;
    amdpTrace?: boolean;
    maxTimeForTracing?: number;
}
export interface IProfilerTraceHitListOptions {
    withSystemEvents?: boolean;
}
export interface IProfilerTraceStatementsOptions {
    id?: number;
    withDetails?: boolean;
    autoDrillDownThreshold?: number;
    withSystemEvents?: boolean;
}
export interface IProfilerTraceDbAccessesOptions {
    withSystemEvents?: boolean;
}
export declare const DEFAULT_PROFILER_TRACE_PARAMETERS: Omit<IProfilerTraceParameters, 'description'>;
export declare function normalizeProfilerTraceId(traceIdOrUri: string): string;
export declare function buildTraceParametersXml(options?: IProfilerTraceParameters): string;
export declare function createTraceParameters(connection: IAbapConnection, options?: IProfilerTraceParameters): Promise<IAdtResponse>;
export declare function extractProfilerIdFromResponse(response: IAdtResponse): string | undefined;
export declare function extractTraceIdFromTraceRequestsResponse(response: IAdtResponse): string | undefined;
/**
 * Get profiler trace hitlist
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional filters
 * @returns Axios response with trace hitlist
 */
export declare function getTraceHitList(connection: IAbapConnection, traceIdOrUri: string, options?: IProfilerTraceHitListOptions): Promise<IAdtResponse>;
/**
 * Get profiler trace statements
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional statement filters
 * @returns Axios response with trace statements
 */
export declare function getTraceStatements(connection: IAbapConnection, traceIdOrUri: string, options?: IProfilerTraceStatementsOptions): Promise<IAdtResponse>;
/**
 * Get profiler trace DB accesses
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional filters
 * @returns Axios response with DB accesses
 */
export declare function getTraceDbAccesses(connection: IAbapConnection, traceIdOrUri: string, options?: IProfilerTraceDbAccessesOptions): Promise<IAdtResponse>;
/**
 * List trace files
 *
 * @param connection - ABAP connection
 * @param options - Optional filters (user)
 * @returns Axios response with list of trace files
 */
export declare function listTraceFiles(connection: IAbapConnection, options?: {
    user?: string;
}): Promise<IAdtResponse>;
/**
 * Get trace parameters
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace parameters
 */
export declare function getTraceParameters(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get trace parameters for callstack aggregation
 *
 * @param connection - ABAP connection
 * @returns Axios response with callstack aggregation parameters
 */
export declare function getTraceParametersForCallstack(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get trace parameters for AMDP trace
 *
 * @param connection - ABAP connection
 * @returns Axios response with AMDP trace parameters
 */
export declare function getTraceParametersForAmdp(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * List trace requests
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of trace requests
 */
export declare function listTraceRequests(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get trace requests filtered by URI
 *
 * @param connection - ABAP connection
 * @param uri - Object URI to filter by
 * @returns Axios response with filtered trace requests
 */
export declare function getTraceRequestsByUri(connection: IAbapConnection, uri: string): Promise<IAdtResponse>;
/**
 * List available object types for tracing
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of object types
 */
export declare function listObjectTypes(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * List available process types for tracing
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of process types
 */
export declare function listProcessTypes(connection: IAbapConnection): Promise<IAdtResponse>;
//# sourceMappingURL=profiler.d.ts.map