/**
 * Message class read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Read message class metadata and messages.
 * GET /sap/bc/adt/messageclass/{name}
 */
export declare function getMessageClassSource(connection: IAbapConnection, name: string, options?: {
    withLongPolling?: boolean;
}): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map