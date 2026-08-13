/**
 * XML parsers for abapGit responses.
 *
 * Uses fast-xml-parser (already a project dependency). Namespace
 * prefixes are stripped via removeNSPrefix; elements are indexed by
 * local name only. Element names and atom-link types below reflect
 * Phase Z live-probe findings.
 */
import type { IAbapGitErrorLogEntry, IAbapGitExternalRepoInfo, IAbapGitRepoStatus } from './types';
export interface IRepoEntityAtomLinks {
    pullLink?: string;
    logLink?: string;
}
export interface IRepoEntityParsed extends IAbapGitRepoStatus {
    atomLinks: IRepoEntityAtomLinks;
}
export declare function parseRepoList(xml: string): IRepoEntityParsed[];
export declare function parseErrorLog(xml: string): IAbapGitErrorLogEntry[];
export declare function parseExternalRepoInfo(xml: string): IAbapGitExternalRepoInfo;
//# sourceMappingURL=xmlParser.d.ts.map