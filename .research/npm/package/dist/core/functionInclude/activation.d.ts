/**
 * FunctionInclude (FUGR/I) activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate function include.
 */
export declare function activateFunctionInclude(connection: IAbapConnection, groupName: string, includeName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map