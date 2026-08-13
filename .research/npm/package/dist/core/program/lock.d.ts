/**
 * Program lock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock program for modification
 * Returns lock handle that must be used in subsequent requests
 */
export declare function lockProgram(connection: IAbapConnection, programName: string): Promise<string>;
/**
 * Lock program for editing (for update)
 * Returns lock handle and transport number
 */
export declare function lockProgramForUpdate(connection: IAbapConnection, programName: string, _sessionId: string): Promise<{
    response: IAdtResponse;
    lockHandle: string;
    corrNr?: string;
}>;
//# sourceMappingURL=lock.d.ts.map