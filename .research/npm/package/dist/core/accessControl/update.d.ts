import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IUpdateAccessControlParams } from './types';
/**
 * Update access control source code
 * Requires object to be locked first (lockHandle must be provided)
 */
export declare function updateAccessControl(connection: IAbapConnection, args: IUpdateAccessControlParams, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map