/**
 * Performance Trace (ST05)
 *
 * Provides functions for managing ST05 performance traces:
 * - Get trace state
 * - Get trace directory
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get ST05 trace state
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace state
 */
export declare function getSt05TraceState(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get ST05 trace directory
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace directory information
 */
export declare function getSt05TraceDirectory(connection: IAbapConnection): Promise<IAdtResponse>;
//# sourceMappingURL=st05.d.ts.map