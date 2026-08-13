/**
 * Behavior Definition create operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IBehaviorDefinitionCreateParams } from './types';
/**
 * Create a new behavior definition
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions
 *
 * @param connection - ABAP connection instance
 * @param params - Creation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with created object metadata
 *
 * @example
 * ```typescript
 * const response = await create(connection, {
 *   name: 'Z_MY_BDEF',
 *   description: 'My Behavior Definition',
 *   package: 'Z_PACKAGE',
 *   implementationType: 'Managed'
 * }, sessionId);
 *
 * // Extract source URI
 * const sourceUri = response.data.match(/abapsource:sourceUri="([^"]+)"/)?.[1];
 * ```
 */
export declare function create(connection: IAbapConnection, params: IBehaviorDefinitionCreateParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map