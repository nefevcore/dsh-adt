import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
/**
 * Check transformation syntax
 */
export declare function checkTransformation(connection: IAbapConnection, transformationName: string, version?: CheckRunVersion, sourceCode?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map