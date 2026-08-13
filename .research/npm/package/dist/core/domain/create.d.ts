/**
 * Domain create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateDomainParams } from './types';
/**
 * Create empty domain (initial POST to register the name)
 * Low-level function - creates domain without locking
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function create(connection: IAbapConnection, args: ICreateDomainParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map