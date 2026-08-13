/**
 * AuthorizationField (SUSO / AUTH) create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 * when the caller intends to keep the lock on the object for further updates.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateAuthorizationFieldParams } from './types';
/**
 * Low-level: Create authorization field (POST /sap/bc/adt/aps/iam/auth)
 */
export declare function create(connection: IAbapConnection, args: ICreateAuthorizationFieldParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map