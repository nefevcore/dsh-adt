import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { IAbapGitRepoStatus } from './types';
export declare function pollUntilTerminal(connection: IAbapConnection, packageName: string, opts?: {
    pollIntervalMs?: number;
    maxPollDurationMs?: number;
    signal?: AbortSignal;
    onProgress?: (status: IAbapGitRepoStatus) => void;
}): Promise<IAbapGitRepoStatus>;
//# sourceMappingURL=poll.d.ts.map