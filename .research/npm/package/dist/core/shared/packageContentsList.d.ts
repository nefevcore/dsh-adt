/**
 * Package contents list operations
 *
 * Provides a flat list view of package contents using node structure traversal.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { IGetPackageContentsListOptions, IPackageContentItem } from './types';
/**
 * Get package contents as a flat list
 *
 * Fetches all objects in a package and returns them as a flat array.
 * Optionally includes contents of subpackages recursively.
 *
 * @param connection - ABAP connection instance
 * @param packageName - Package name
 * @param options - Optional options for fetching
 * @param logger - Optional logger
 * @returns Array of package content items
 */
export declare function getPackageContentsList(connection: IAbapConnection, packageName: string, options?: IGetPackageContentsListOptions, logger?: ILogger): Promise<IPackageContentItem[]>;
//# sourceMappingURL=packageContentsList.d.ts.map