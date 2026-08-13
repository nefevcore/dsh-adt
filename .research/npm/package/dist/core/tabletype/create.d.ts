/**
 * TableType create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateTableTypeParams } from './types';
/**
 * Create empty ABAP table type (XML-based entity like Domain/DataElement)
 * Low-level function: creates empty table type via POST endpoint
 * rowType should be added via update() method
 */
export declare function createTableType(connection: IAbapConnection, params: ICreateTableTypeParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map