/**
 * XML builders for abapGit request envelopes.
 *
 * link/pull use the 'repositories' namespace; externalRepoInfo uses a
 * separate 'externalRepo' namespace (Phase Z confirmed — capital R,
 * no 'info' suffix). Null/undefined fields are omitted from the body
 * (sapcli parity).
 */
import type { IAbapGitExternalRepoCredentials, IAbapGitLinkArgs, IAbapGitPullArgs } from './types';
export declare function buildLinkBody(args: IAbapGitLinkArgs): string;
export declare function buildPullBody(args: IAbapGitPullArgs, resolvedBranch: string): string;
export declare function buildExternalRepoInfoBody(args: IAbapGitExternalRepoCredentials): string;
//# sourceMappingURL=xmlBuilder.d.ts.map