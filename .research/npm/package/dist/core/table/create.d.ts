/**
 * Table create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateTableParams } from './types';
/**
 * Create empty ABAP table
 * Low-level function: only creates empty table via POST endpoint
 * DDL code should be added via update() method
 */
export declare function createTable(connection: IAbapConnection, params: ICreateTableParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map