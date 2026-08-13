/**
 * FunctionModule activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate function module
 */
export declare function activateFunctionModule(connection: IAbapConnection, functionGroupName: string, functionModuleName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map