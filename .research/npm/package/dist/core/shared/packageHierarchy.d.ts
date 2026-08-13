/**
 * Package hierarchy operations
 *
 * Builds a tree of package contents using node structure traversal.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { IGetPackageHierarchyOptions, IPackageHierarchyNode } from './types';
export declare function getPackageHierarchy(connection: IAbapConnection, packageName: string, options?: IGetPackageHierarchyOptions, logger?: ILogger): Promise<IPackageHierarchyNode>;
//# sourceMappingURL=packageHierarchy.d.ts.map