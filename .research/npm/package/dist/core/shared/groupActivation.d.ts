/**
 * Group Activation operations - activate multiple objects with session support
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IObjectReference } from './types';
/**
 * Activate multiple objects in a group (with session support)
 *
 * Implements the EclipseADT activation flow:
 * 1. POST /sap/bc/adt/activation/runs?method=activate&preauditRequested=false - Start activation
 * 2. GET /sap/bc/adt/activation/runs/{runId}?withLongPolling=true - Poll for completion
 * 3. GET /sap/bc/adt/activation/results/{runId} - Get activation results
 * 4. GET /sap/bc/adt/activation/inactiveobjects - Check for remaining inactive objects
 *
 * This function allows activating multiple objects of different types in a single request.
 * Useful for activating related objects together (e.g., BDEF + CDS view).
 *
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to activate
 * @param preauditRequested - Request pre-audit before activation (default: false)
 * @returns Axios response with activation result (from step 3 - activation results)
 *
 * @example
 * ```typescript
 * // Activate BDEF and related CDS view together
 * const objects = [
 *   {
 *     type: 'BDEF/BDO',
 *     name: 'ZDEMO_I_CDS_VIEW'
 *   },
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZDEMO_C_CDS_VIEW'
 *   }
 * ];
 *
 * const result = await activateObjectsGroup(connection, objects);
 * ```
 */
export declare function activateObjectsGroup(connection: IAbapConnection, objects: IObjectReference[], preauditRequested?: boolean): Promise<IAdtResponse>;
//# sourceMappingURL=groupActivation.d.ts.map