/**
 * Program run operations - execute ABAP executable programs
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Run an ABAP executable program.
 *
 * Endpoint: POST /sap/bc/adt/programs/programrun/{programName}
 */
export declare function runProgram(connection: IAbapConnection, programName: string, _sessionId?: string): Promise<IAdtResponse>;
//# sourceMappingURL=run.d.ts.map