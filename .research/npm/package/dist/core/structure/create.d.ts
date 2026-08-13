/**
 * Structure create operations
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateStructureParams } from './types';
/**
 * Create empty structure metadata via POST
 * Low-level function - creates metadata without DDL content
 */
export declare function create(connection: IAbapConnection, params: ICreateStructureParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map