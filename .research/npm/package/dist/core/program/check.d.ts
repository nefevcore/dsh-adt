/**
 * Program check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
/**
 * Check program syntax
 */
export declare function checkProgram(connection: IAbapConnection, programName: string, version?: CheckRunVersion, sourceCode?: string, artifactContentType?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map