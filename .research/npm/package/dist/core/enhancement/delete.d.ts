/**
 * Enhancement delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type IDeleteEnhancementParams } from './types';
/**
 * Low-level: Check if enhancement can be deleted (deletion check)
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion check result
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteEnhancementParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete enhancement using ADT deletion API
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion result
 */
export declare function deleteEnhancement(connection: IAbapConnection, params: IDeleteEnhancementParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map