import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { IAbapGitErrorLogEntry } from './types';
export declare function getErrorLog(connection: IAbapConnection, packageName: string): Promise<IAbapGitErrorLogEntry[]>;
//# sourceMappingURL=getErrorLog.d.ts.map