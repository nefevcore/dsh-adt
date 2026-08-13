/**
 * GatewayErrorLog - Low-level read functions
 *
 * Provides access to SAP Gateway error log (/IWFND/ERROR_LOG):
 * - List gateway errors with optional filtering
 * - Get individual error details by type and ID
 */
import type { IAbapConnection, IAdtResponse, IFeedQueryOptions } from '@mcp-abap-adt/interfaces';
/**
 * List gateway errors
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with gateway error log feed
 */
export declare function listGatewayErrors(connection: IAbapConnection, options?: IFeedQueryOptions): Promise<IAdtResponse>;
/**
 * Get a single gateway error by type and ID
 *
 * @param connection - ABAP connection
 * @param errorType - Error type (e.g. 'Frontend Error')
 * @param errorId - Error transaction ID
 * @returns Axios response with gateway error details
 */
export declare function getGatewayError(connection: IAbapConnection, errorType: string, errorId: string): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map