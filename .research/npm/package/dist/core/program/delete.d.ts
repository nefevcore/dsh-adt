/**
 * Program delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteProgramParams } from './types';
/**
 * Low-level: Check if program can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteProgramParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete program
 */
export declare function deleteProgram(connection: IAbapConnection, params: IDeleteProgramParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map