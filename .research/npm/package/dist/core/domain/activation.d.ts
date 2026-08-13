/**
 * Domain activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate domain
 * Makes domain active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function activateDomain(connection: IAbapConnection, domainName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map