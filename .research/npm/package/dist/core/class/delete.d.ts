/**
 * Class delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteClassParams } from './types';
/**
 * Low-level: Check if class can be deleted (deletion check)
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteClassParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete class using ADT deletion API
 */
export declare function deleteClass(connection: IAbapConnection, params: IDeleteClassParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map