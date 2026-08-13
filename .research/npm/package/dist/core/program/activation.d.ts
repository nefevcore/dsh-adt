/**
 * Program activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate program
 * Makes program active and usable in SAP system
 */
export declare function activateProgram(connection: IAbapConnection, programName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map