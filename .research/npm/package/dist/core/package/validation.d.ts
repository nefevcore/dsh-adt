/**
 * Package validation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreatePackageParams } from './types';
/**
 * Step 1: Validate package parameters (basic check)
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export declare function validatePackageBasic(connection: IAbapConnection, args: ICreatePackageParams): Promise<IAdtResponse>;
/**
 * Step 3: Full validation with transport layer
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export declare function validatePackageFull(connection: IAbapConnection, args: ICreatePackageParams, swcomp: string, transportLayer: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map