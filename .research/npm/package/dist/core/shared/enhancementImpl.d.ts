/**
 * Enhancement implementation operations
 *
 * Retrieves source code of specific enhancement implementations.
 * Uses different URL format: /sap/bc/adt/enhancements/{spot}/{name}/source/main
 * where spot is the enhancement spot name (not type).
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get enhancement implementation source code
 *
 * Endpoint: GET /sap/bc/adt/enhancements/{spot}/{name}/source/main
 *
 * Note: This uses spot name in URL instead of enhancement type.
 * Different from standard enhancement operations which use type in URL.
 *
 * @param connection - ABAP connection instance
 * @param enhancementSpot - Enhancement spot name (e.g., 'enhoxhh')
 * @param enhancementName - Enhancement implementation name
 * @returns Axios response with XML containing enhancement source code
 *
 * @example
 * ```typescript
 * const response = await getEnhancementImpl(connection, 'enhoxhh', 'zpartner_update_pai');
 * // Response contains XML with enhancement source code
 * ```
 */
export declare function getEnhancementImpl(connection: IAbapConnection, enhancementSpot: string, enhancementName: string): Promise<IAdtResponse>;
//# sourceMappingURL=enhancementImpl.d.ts.map