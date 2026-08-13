/**
 * Program read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP program metadata (without source code)
 */
export declare function getProgramMetadata(connection: IAbapConnection, programName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP program source code
 */
export declare function getProgramSource(connection: IAbapConnection, programName: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP program (source code by default for backward compatibility)
 * @deprecated Use getProgramSource() or getProgramMetadata() instead
 */
export declare function getProgram(connection: IAbapConnection, programName: string): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP program
 * @param connection - SAP connection
 * @param programName - Program name
 * @returns Transport request information
 */
export declare function getProgramTransport(connection: IAbapConnection, programName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map