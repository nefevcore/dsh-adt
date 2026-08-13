/**
 * Domain lock operations
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ICreateDomainParams } from './types';
/**
 * Acquire lock handle by attempting to lock the domain (for create)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function acquireLockHandle(connection: IAbapConnection, args: ICreateDomainParams): Promise<string>;
/**
 * Lock domain for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function lockDomain(connection: IAbapConnection, domainName: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map