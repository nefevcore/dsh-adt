/**
 * Message class delete operations.
 *
 * Uses the stateless ADT deletion service (`/sap/bc/adt/deletion/check` +
 * `/sap/bc/adt/deletion/delete`) — the same mechanism Eclipse ADT and the other
 * object types (domain, serviceDefinition, …) use. A direct
 * `DELETE /messageclass/{name}?lockHandle=` leaves a lingering message-editing
 * enqueue ("User is currently editing …") that blocks a same-name re-create, so
 * it is NOT used here.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Low-level: check whether the message class can be deleted.
 * POST /sap/bc/adt/deletion/check
 */
export declare function checkDeletion(connection: IAbapConnection, name: string): Promise<IAdtResponse>;
/**
 * Low-level: delete the message class via the deletion service.
 * POST /sap/bc/adt/deletion/delete (stateless — no lock handle).
 *
 * For a transportable package pass `transportRequest` (emitted as
 * `<del:transportNumber>`), like domain; local packages send an empty tag.
 */
export declare function deleteMessageClass(connection: IAbapConnection, name: string, transportRequest?: string): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map