/**
 * Feed Reader
 *
 * Provides functions for accessing feed repository:
 * - Get feeds
 * - Get feed variants
 */
import type { IAbapConnection, IAdtResponse, IFeedQueryOptions } from '@mcp-abap-adt/interfaces';
/**
 * Get feeds
 *
 * @param connection - ABAP connection
 * @returns Axios response with feeds
 */
export declare function getFeeds(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get feed variants
 *
 * @param connection - ABAP connection
 * @returns Axios response with feed variants
 */
export declare function getFeedVariants(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Build query string from IFeedQueryOptions.
 * Shared by all feed-backed runtime modules.
 *
 * @param options - Query options
 * @param userAttribute - Feed-specific user attribute name ('user' for dumps, 'username' for gateway)
 */
export declare function buildFeedQueryParams(options?: IFeedQueryOptions, userAttribute?: string): string;
/**
 * Fetch a feed by URL with optional query parameters
 *
 * @param connection - ABAP connection
 * @param feedUrl - Feed URL path
 * @param options - Query options (user filter, pagination, date range)
 * @returns Axios response with Atom XML feed
 */
export declare function fetchFeed(connection: IAbapConnection, feedUrl: string, options?: IFeedQueryOptions, userAttribute?: string): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map