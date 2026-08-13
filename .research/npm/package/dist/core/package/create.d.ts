/**
 * Package create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreatePackageParams } from './types';
/**
 * Create ABAP package via single ADT POST (no validation or follow-up checks).
 */
export declare function createPackage(connection: IAbapConnection, params: ICreatePackageParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map