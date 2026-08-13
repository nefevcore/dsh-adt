/**
 * Structure check operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
/**
 * Check structure syntax
 * Note: For DDIC objects like structures, check may not be fully supported in all SAP systems.
 * If check fails with "inactive version does not exist" or "importing from database" error, it's often safe to skip.
 */
export declare function checkStructure(connection: IAbapConnection, structureName: string, version?: CheckRunVersion, sourceCode?: string, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map