/**
 * ATC (ABAP Test Cockpit) Logs
 *
 * Provides functions for reading ATC check failure logs and execution logs:
 * - Get check failure logs
 * - Get execution log
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get check failure logs options
 */
export interface IGetCheckFailureLogsOptions {
    displayId?: string;
    objName?: string;
    objType?: string;
    moduleId?: string;
    phaseKey?: string;
}
/**
 * Get ATC check failure logs
 *
 * @param connection - ABAP connection
 * @param options - Optional filters
 * @returns Axios response with check failure logs
 */
export declare function getCheckFailureLogs(connection: IAbapConnection, options?: IGetCheckFailureLogsOptions): Promise<IAdtResponse>;
/**
 * Get ATC execution log
 *
 * @param connection - ABAP connection
 * @param executionId - Execution ID
 * @returns Axios response with execution log
 */
export declare function getExecutionLog(connection: IAbapConnection, executionId: string): Promise<IAdtResponse>;
//# sourceMappingURL=logs.d.ts.map