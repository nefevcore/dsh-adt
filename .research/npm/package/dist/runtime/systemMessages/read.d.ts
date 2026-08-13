/**
 * SystemMessages - Low-level read functions
 *
 * Provides access to system messages (SM02):
 * - List system messages with optional filtering
 * - Get individual system message by ID
 */
import type { IAbapConnection, IAdtResponse, IFeedQueryOptions } from '@mcp-abap-adt/interfaces';
/**
 * List system messages
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with system messages feed
 */
export declare function listSystemMessages(connection: IAbapConnection, options?: IFeedQueryOptions): Promise<IAdtResponse>;
/**
 * Get a single system message by ID
 *
 * @param connection - ABAP connection
 * @param messageId - System message ID
 * @returns Axios response with system message details
 */
export declare function getSystemMessage(connection: IAbapConnection, messageId: string): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map