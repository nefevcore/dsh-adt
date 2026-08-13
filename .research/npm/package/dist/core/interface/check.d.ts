/**
 * Interface check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
/**
 * Check interface syntax
 */
export declare function checkInterface(connection: IAbapConnection, interfaceName: string, version?: CheckRunVersion, sourceCode?: string, artifactContentType?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map