/**
 * Table activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate the table after creation
 */
export declare function activateTable(connection: IAbapConnection, tableName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map