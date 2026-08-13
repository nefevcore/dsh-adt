/**
 * Package delete operations
 */
import type { IAbapConnection, IAdtResponse, IDeletePackageParams } from '@mcp-abap-adt/interfaces';
/**
 * Check if package can be deleted (deletion check)
 * Returns response with isDeletable flag
 *
 * NOTE: Uses stateful session headers automatically if connection has stateful mode enabled
 */
export declare function checkPackageDeletion(connection: IAbapConnection, params: IDeletePackageParams): Promise<IAdtResponse>;
/**
 * Parse deletion check response to get isDeletable flag
 */
export declare function parsePackageDeletionCheck(response: IAdtResponse): {
    isDeletable: boolean;
    message?: string;
};
/**
 * Delete ABAP package using ADT deletion API
 * For packages, empty transportNumber tag may be required
 */
export declare function deletePackage(connection: IAbapConnection, params: IDeletePackageParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map