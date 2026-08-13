/**
 * AuthorizationField (SUSO / AUTH) delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export interface IDeleteAuthorizationFieldParams {
    authorization_field_name: string;
    transport_request?: string;
}
/**
 * Low-level: Check if authorization field can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteAuthorizationFieldParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete authorization field
 */
export declare function deleteAuthorizationField(connection: IAbapConnection, params: IDeleteAuthorizationFieldParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map