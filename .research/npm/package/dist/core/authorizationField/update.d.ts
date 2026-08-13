/**
 * AuthorizationField (SUSO / AUTH) update operations
 *
 * Requires a valid lockHandle (acquired via lockAuthorizationField).
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { ICreateAuthorizationFieldParams } from './types';
/**
 * Update authorization field via PUT.
 * The payload has the same shape as create; only unspecified optional fields
 * are omitted (server preserves their prior values).
 */
export declare function updateAuthorizationField(connection: IAbapConnection, params: ICreateAuthorizationFieldParams, lockHandle: string, logger?: ILogger): Promise<void>;
//# sourceMappingURL=update.d.ts.map