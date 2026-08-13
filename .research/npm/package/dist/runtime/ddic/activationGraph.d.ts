/**
 * DDIC Activation Graph
 *
 * Provides functions for reading DDIC activation dependency graph with logs:
 * - Get activation graph
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get activation graph options
 */
export interface IGetActivationGraphOptions {
    objectName?: string;
    objectType?: string;
    logName?: string;
}
/**
 * Get DDIC activation graph with logs
 *
 * @param connection - ABAP connection
 * @param options - Optional parameters
 * @returns Axios response with activation graph
 */
export declare function getActivationGraph(connection: IAbapConnection, options?: IGetActivationGraphOptions): Promise<IAdtResponse>;
//# sourceMappingURL=activationGraph.d.ts.map