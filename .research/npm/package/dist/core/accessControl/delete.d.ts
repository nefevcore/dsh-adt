import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteAccessControlParams } from './types';
/**
 * Low-level: Check if access control can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteAccessControlParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete access control
 */
export declare function deleteAccessControl(connection: IAbapConnection, params: IDeleteAccessControlParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map