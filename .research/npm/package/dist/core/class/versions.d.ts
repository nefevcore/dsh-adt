import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
/** Class source lives in includes, not a single source/main resource. */
export type ClassIncludeType = 'main' | 'definitions' | 'implementations' | 'testclasses' | 'macros';
export declare function getClassIncludeVersions(connection: IAbapConnection, className: string, includeType: ClassIncludeType): Promise<IObjectVersion[]>;
export declare function getClassVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map