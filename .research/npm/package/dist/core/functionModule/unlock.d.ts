/**
 * FunctionModule unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock function module
 */
export declare function unlockFunctionModule(connection: IAbapConnection, functionGroupName: string, functionModuleName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map