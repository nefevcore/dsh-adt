/**
 * Message class lock operations
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Lock a message class for modification.
 * Returns the lock handle that must be used in subsequent update/delete requests.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export declare function lockMessageClass(connection: IAbapConnection, name: string): Promise<string>;
/**
 * Lock an individual message for modification.
 * Returns the message lock handle (MH) used in PUT XML as mc:lockhandle.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export declare function lockMessage(connection: IAbapConnection, name: string, no: string): Promise<string>;
/**
 * Lock a message class in the context of a specific message save.
 * Returns the class lock handle (CH) used in PUT ?lockHandle= parameter.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export declare function lockClassForMessage(connection: IAbapConnection, name: string, no: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map