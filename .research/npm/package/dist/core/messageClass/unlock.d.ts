/**
 * Message class unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock a message class after modification.
 *
 * NOTE: Caller should call connection.setSessionType('stateless') after this.
 */
export declare function unlockMessageClass(connection: IAbapConnection, name: string, lockHandle: string): Promise<IAdtResponse>;
/**
 * Release all message-level locks for a specific message number.
 * Must be called after the class PUT to release the LOCK_MSG handle.
 */
export declare function unlockAllMessages(connection: IAbapConnection, name: string, no: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map