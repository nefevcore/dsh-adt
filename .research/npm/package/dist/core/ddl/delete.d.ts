/**
 * View delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteDdlParams } from './types';
/**
 * Low-level: Check if view can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteDdlParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete view (DDLS)
 */
export declare function deleteDdl(connection: IAbapConnection, params: IDeleteDdlParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map