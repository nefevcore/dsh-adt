/**
 * Message class update operations
 *
 * Uses read-modify-write pattern: GET current XML → apply description override
 * → rebuild full XML (messages preserved) → PUT with lock handle.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Update a message class description.
 * Reads the current XML first to preserve all existing messages and attributes,
 * then rebuilds the full XML with the description override and PUTs it back.
 *
 * NOTE: Caller must enable stateful session and hold a valid lockHandle.
 */
export declare function updateMessageClass(connection: IAbapConnection, name: string, lockHandle: string, description: string | undefined, transportRequest?: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map