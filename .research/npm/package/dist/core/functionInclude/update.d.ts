/**
 * FunctionInclude (FUGR/I) metadata update operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Body is identical to create; only the URL differs (PUT to single-object URL
 * with ?lockHandle=...).
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { ICreateFunctionIncludeParams } from './types';
/**
 * Update function include metadata via PUT.
 */
export declare function updateFunctionInclude(connection: IAbapConnection, params: ICreateFunctionIncludeParams, lockHandle: string, logger?: ILogger): Promise<void>;
//# sourceMappingURL=update.d.ts.map