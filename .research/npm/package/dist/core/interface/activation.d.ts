/**
 * Interface activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate interface
 * Makes interface active and usable in SAP system
 */
export declare function activateInterface(connection: IAbapConnection, interfaceName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map