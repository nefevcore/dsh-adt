/**
 * Program update operations - low-level functions for AdtProgram
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Upload program source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtProgram
 */
export declare function uploadProgramSource(connection: IAbapConnection, programName: string, sourceCode: string, lockHandle: string, _sessionId: string, corrNr?: string): Promise<import("@mcp-abap-adt/interfaces").IAdtResponse<any, any>>;
//# sourceMappingURL=update.d.ts.map