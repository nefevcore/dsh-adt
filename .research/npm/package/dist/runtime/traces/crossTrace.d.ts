/**
 * ABAP Cross Trace
 *
 * Provides functions for managing ABAP cross traces:
 * - List traces with filters
 * - Get trace details (with optional sensitive data)
 * - Get trace records
 * - Get record content
 * - Get trace activations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * List traces options
 */
export interface IListCrossTracesOptions {
    traceUser?: string;
    actCreateUser?: string;
    actChangeUser?: string;
}
/**
 * List cross traces
 *
 * @param connection - ABAP connection
 * @param options - Optional filters
 * @returns Axios response with list of traces
 */
export declare function listCrossTraces(connection: IAbapConnection, options?: IListCrossTracesOptions): Promise<IAdtResponse>;
/**
 * Get trace details
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @param includeSensitiveData - Whether to include sensitive data
 * @returns Axios response with trace details
 */
export declare function getCrossTrace(connection: IAbapConnection, traceId: string, includeSensitiveData?: boolean): Promise<IAdtResponse>;
/**
 * Get trace records
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @returns Axios response with trace records
 */
export declare function getCrossTraceRecords(connection: IAbapConnection, traceId: string): Promise<IAdtResponse>;
/**
 * Get trace record content
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @param recordNumber - Record number
 * @returns Axios response with record content
 */
export declare function getCrossTraceRecordContent(connection: IAbapConnection, traceId: string, recordNumber: number): Promise<IAdtResponse>;
/**
 * Get trace activations
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace activations
 */
export declare function getCrossTraceActivations(connection: IAbapConnection): Promise<IAdtResponse>;
//# sourceMappingURL=crossTrace.d.ts.map