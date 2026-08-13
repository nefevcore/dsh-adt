/**
 * TableType activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate the table type after creation
 */
export declare function activateTableType(connection: IAbapConnection, tableTypeName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map