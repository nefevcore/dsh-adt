/**
 * ADT-integrated abapGit client.
 *
 * Standalone top-level class — NOT a factory on AdtClient (which is
 * reserved for IAdtObject<Config, State> implementations only).
 * Consumers instantiate directly: new AdtAbapGitClient(connection, logger, options).
 *
 * Implements IAdtAbapGitClient. HTTP operations are delegated to
 * low-level functions in ./abapGit/*; this class owns the options,
 * enforces the public contract, and keeps the call sites cast-free
 * by implementing the specialized interface.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAbapGitErrorLogEntry, IAbapGitExternalRepoCredentials, IAbapGitExternalRepoInfo, IAbapGitLinkArgs, IAbapGitPullArgs, IAbapGitPullResult, IAbapGitRepoStatus, IAbapGitUnlinkArgs, IAdtAbapGitClient, IAdtAbapGitClientOptions } from './abapGit/types';
export declare class AdtAbapGitClient implements IAdtAbapGitClient {
    private readonly connection;
    private readonly logger?;
    private readonly contentTypeVersion;
    constructor(connection: IAbapConnection, logger?: ILogger, options?: IAdtAbapGitClientOptions);
    link(args: IAbapGitLinkArgs): Promise<void>;
    pull(args: IAbapGitPullArgs): Promise<IAbapGitPullResult>;
    unlink(args: IAbapGitUnlinkArgs): Promise<void>;
    listRepos(): Promise<IAbapGitRepoStatus[]>;
    getRepo(packageName: string): Promise<IAbapGitRepoStatus | undefined>;
    getErrorLog(packageName: string): Promise<IAbapGitErrorLogEntry[]>;
    checkExternalRepo(args: IAbapGitExternalRepoCredentials): Promise<IAbapGitExternalRepoInfo>;
}
//# sourceMappingURL=AdtAbapGitClient.d.ts.map