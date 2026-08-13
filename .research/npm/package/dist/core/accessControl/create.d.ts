import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateAccessControlParams } from './types';
/**
 * Low-level: Create access control (POST)
 * Does NOT activate - just creates the object
 */
export declare function create(connection: IAbapConnection, args: ICreateAccessControlParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map