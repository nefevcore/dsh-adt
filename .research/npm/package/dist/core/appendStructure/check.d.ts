import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
export declare function checkAppendStructure(connection: IAbapConnection, name: string, version?: CheckRunVersion, sourceCode?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map