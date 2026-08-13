/**
 * Structure activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate the structure after creation
 */
export declare function activateStructure(connection: IAbapConnection, structureName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map