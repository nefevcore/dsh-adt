/**
 * Interface delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteInterfaceParams } from './types';
/**
 * Low-level: Check if interface can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteInterfaceParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete interface
 */
export declare function deleteInterface(connection: IAbapConnection, params: IDeleteInterfaceParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map