/**
 * View check operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
export declare function checkDdl(connection: IAbapConnection, ddlName: string, version?: CheckRunVersion, sourceCode?: string, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map