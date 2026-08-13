/**
 * Class activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate class
 * Makes class active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function activateClass(connection: IAbapConnection, className: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map