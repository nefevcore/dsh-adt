/**
 * Program unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock program
 * Must use same session and lock handle from lock operation
 */
export declare function unlockProgram(connection: IAbapConnection, programName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map