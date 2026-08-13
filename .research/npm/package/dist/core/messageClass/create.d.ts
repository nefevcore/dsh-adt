/**
 * Message class create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateMessageClassParams } from './types';
/**
 * Create a new message class (shell — no messages yet).
 * POST /sap/bc/adt/messageclass[?corrNr={transport}] with Content-Type application/xml.
 * For a transportable package pass `transport_request` (added as `?corrNr=`), like
 * domain/class create; local packages send no corrNr.
 */
export declare function createMessageClass(connection: IAbapConnection, params: ICreateMessageClassParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map