import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { IAbapGitPullArgs, IAbapGitPullResult } from './types';
export declare function pullRepo(connection: IAbapConnection, args: IAbapGitPullArgs, contentTypeVersion?: 'v3' | 'v4'): Promise<IAbapGitPullResult>;
//# sourceMappingURL=pull.d.ts.map