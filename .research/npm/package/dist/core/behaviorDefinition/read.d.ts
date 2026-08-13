/**
 * Behavior Definition read operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Read behavior definition metadata
 *
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}?version=inactive
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with behavior definition metadata (XML)
 *
 * @example
 * ```typescript
 * const response = await read(connection, 'Z_MY_BDEF', sessionId);
 * // Response contains metadata in blue:blueSource XML format
 * ```
 */
export declare function read(connection: IAbapConnection, name: string, _sessionId: string, version?: string, options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Read behavior definition source code
 *
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with source code (plain text)
 *
 * @example
 * ```typescript
 * const response = await readSource(connection, 'Z_MY_BDEF', sessionId);
 * const sourceCode = response.data; // BDEF source code
 * ```
 */
export declare function readSource(connection: IAbapConnection, name: string, version?: string, options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP behavior definition
 * @param connection - SAP connection
 * @param name - Behavior definition name
 * @returns Transport request information
 */
export declare function getBehaviorDefinitionTransport(connection: IAbapConnection, name: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map