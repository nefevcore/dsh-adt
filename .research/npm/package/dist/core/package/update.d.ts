/**
 * Package update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (abapLanguageVersion, etc.)
 * that would be lost if XML were built from scratch.
 */
import type { IAbapConnection, IAdtResponse, IUpdatePackageParams } from '@mcp-abap-adt/interfaces';
/**
 * Update package with new data (read-modify-write pattern)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function updatePackage(connection: IAbapConnection, params: IUpdatePackageParams, lockHandle: string): Promise<IAdtResponse>;
/**
 * Update only package description (safe update - only modifiable field)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function updatePackageDescription(connection: IAbapConnection, packageName: string, description: string, lockHandle: string, superPackage?: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map