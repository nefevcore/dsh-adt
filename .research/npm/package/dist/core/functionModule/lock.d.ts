/**
 * FunctionModule lock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock function module for editing
 */
export declare function lockFunctionModule(connection: IAbapConnection, functionGroupName: string, functionModuleName: string): Promise<string>;
/**
 * Lock function module for editing (for update)
 */
export declare function lockFunctionModuleForUpdate(connection: IAbapConnection, functionGroupName: string, functionModuleName: string, _sessionId: string): Promise<{
    response: IAdtResponse;
    lockHandle: string;
    corrNr?: string;
}>;
//# sourceMappingURL=lock.d.ts.map