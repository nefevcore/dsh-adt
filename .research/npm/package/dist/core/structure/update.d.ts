/**
 * Structure update operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IUpdateStructureParams } from './types';
/**
 * Upload structure DDL code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtStructure
 */
export declare function upload(connection: IAbapConnection, params: IUpdateStructureParams, lockHandle: string): Promise<IAdtResponse>;
/**
 * Update structure with DDL code (alias for upload with lockHandle in params)
 */
export declare function updateStructure(connection: IAbapConnection, params: IUpdateStructureParams & {
    lockHandle: string;
}): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map