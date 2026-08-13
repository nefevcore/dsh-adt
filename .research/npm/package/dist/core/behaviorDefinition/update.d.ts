/**
 * Behavior Definition update operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IUpdateBehaviorDefinitionParams } from './types';
/**
 * Update behavior definition source code
 *
 * Endpoint: PUT /sap/bc/adt/bo/behaviordefinitions/{name}/source/main?lockHandle={handle}
 *
 * Requires behavior definition to be locked first
 *
 * @param connection - ABAP connection instance
 * @param params - Update parameters
 * @returns Axios response with updated source code
 *
 * @example
 * ```typescript
 * const source = `managed implementation in class zbp_my_bdef unique;
 * strict ( 2 );
 *
 * define behavior for Z_MY_ENTITY
 * persistent table z_my_table
 * lock master
 * authorization master ( instance )
 * {
 *   create;
 *   update;
 *   delete;
 * }`;
 *
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * await update(connection, {
 *   name: 'Z_MY_BDEF',
 *   sourceCode: source,
 *   lockHandle,
 *   transportRequest: 'E19K905635'
 * });
 * await unlock(connection, 'Z_MY_BDEF', lockHandle, sessionId);
 * ```
 */
export declare function update(connection: IAbapConnection, params: IUpdateBehaviorDefinitionParams): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map