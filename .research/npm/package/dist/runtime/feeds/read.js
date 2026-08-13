"use strict";
/**
 * Feed Reader
 *
 * Provides functions for accessing feed repository:
 * - Get feeds
 * - Get feed variants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeeds = getFeeds;
exports.getFeedVariants = getFeedVariants;
exports.buildFeedQueryParams = buildFeedQueryParams;
exports.fetchFeed = fetchFeed;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get feeds
 *
 * @param connection - ABAP connection
 * @returns Axios response with feeds
 */
async function getFeeds(connection) {
    const url = `/sap/bc/adt/feeds`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/atom+xml;type=feed',
        },
    });
}
/**
 * Get feed variants
 *
 * @param connection - ABAP connection
 * @returns Axios response with feed variants
 */
async function getFeedVariants(connection) {
    const url = `/sap/bc/adt/feeds/variants`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/atom+xml;type=feed',
        },
    });
}
/**
 * Build query string from IFeedQueryOptions.
 * Shared by all feed-backed runtime modules.
 *
 * @param options - Query options
 * @param userAttribute - Feed-specific user attribute name ('user' for dumps, 'username' for gateway)
 */
function buildFeedQueryParams(options, userAttribute = 'user') {
    if (!options)
        return '';
    const params = new URLSearchParams();
    if (options.user) {
        params.set('$query', `and ( equals ( ${userAttribute} , ${options.user.trim()} ) )`);
    }
    if (options.maxResults) {
        params.set('$top', String(options.maxResults));
    }
    if (options.from)
        params.set('from', options.from);
    if (options.to)
        params.set('to', options.to);
    const query = params.toString();
    return query ? `?${query}` : '';
}
/**
 * Fetch a feed by URL with optional query parameters
 *
 * @param connection - ABAP connection
 * @param feedUrl - Feed URL path
 * @param options - Query options (user filter, pagination, date range)
 * @returns Axios response with Atom XML feed
 */
async function fetchFeed(connection, feedUrl, options, userAttribute) {
    const url = `${feedUrl}${buildFeedQueryParams(options, userAttribute)}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: 'application/atom+xml;type=feed' },
    });
}
