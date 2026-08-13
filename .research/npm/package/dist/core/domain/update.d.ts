/**
 * Domain update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IUpdateDomainParams } from './types';
/**
 * Update domain with new data (read-modify-write pattern)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function updateDomain(connection: IAbapConnection, args: IUpdateDomainParams, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map