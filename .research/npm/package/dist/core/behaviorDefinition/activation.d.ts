/**
 * Behavior Definition activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate behavior definition
 *
 * Makes behavior definition active and usable in SAP system
 *
 * Endpoint: POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param preauditRequested - Request preaudit (default: true)
 * @returns Axios response with activation result
 *
 * @example
 * ```typescript
 * await activate(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
export declare function activate(connection: IAbapConnection, name: string, preauditRequested?: boolean): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map