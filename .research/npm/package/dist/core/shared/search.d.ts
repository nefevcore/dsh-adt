/**
 * Search operations for ABAP objects
 */
import type { IAbapConnection, IAdtResponse, ISearchResult } from '@mcp-abap-adt/interfaces';
import type { ISearchObjectsParams } from './types';
/**
 * Search for ABAP objects by name pattern
 *
 * @param connection - ABAP connection
 * @param params - Search parameters
 * @returns Search results
 */
export declare function searchObjects(connection: IAbapConnection, params: ISearchObjectsParams): Promise<IAdtResponse>;
/**
 * Parse a quickSearch response into typed hits.
 *
 * Exported so the raw `searchObjects` above stays available: a caller that
 * needs headers, status or the untouched XML keeps it, and a caller that just
 * wants the objects uses `searchObjectsTyped`. Removing the raw form would take
 * away a choice that costs us nothing to keep.
 */
export declare function parseSearchResults(xml: string): ISearchResult[];
/** Search for ABAP objects and return the hits, parsed. */
export declare function searchObjectsTyped(connection: IAbapConnection, params: ISearchObjectsParams): Promise<ISearchResult[]>;
//# sourceMappingURL=search.d.ts.map