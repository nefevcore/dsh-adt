/**
 * AuthorizationField (SUSO / AUTH) lock operation
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
/**
 * Lock authorization field for modification.
 * Returns LOCK_HANDLE that must be passed to update/unlock.
 */
export declare function lockAuthorizationField(connection: IAbapConnection, name: string, logger?: ILogger): Promise<string>;
//# sourceMappingURL=lock.d.ts.map