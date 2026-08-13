"use strict";
/**
 * Runtime Dumps (ABAP Short Dump Analysis)
 *
 * Provides functions for reading ABAP runtime dumps via ADT endpoints:
 * - List dumps feed with paging/query options
 * - List dumps by user
 * - Read dump by ID (default/summary/formatted view)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDumpIdPrefix = buildDumpIdPrefix;
exports.buildRuntimeDumpsUserQuery = buildRuntimeDumpsUserQuery;
exports.listRuntimeDumps = listRuntimeDumps;
exports.listRuntimeDumpsByUser = listRuntimeDumpsByUser;
exports.getRuntimeDumpById = getRuntimeDumpById;
const timeouts_1 = require("../../utils/timeouts");
function normalizeDumpId(dumpId) {
    const normalized = dumpId?.trim();
    if (!normalized) {
        throw new Error('Runtime dump ID is required');
    }
    if (normalized.includes('/')) {
        throw new Error('Runtime dump ID must not contain "/"');
    }
    return normalized;
}
function appendIfDefined(params, key, value) {
    if (value === undefined || value === null || value === '') {
        return;
    }
    params.set(key, String(value));
}
/**
 * Build a runtime dump ID prefix from its known components.
 *
 * The full dump ID is a compound key: `{datetime}{hostname}_{sysid}_{instance}{user}{client}{seq}`.
 * All fields except `seq` are typically available from external sources (e.g. CALM events).
 * Use this prefix with `from`/`to` time-range filtering to locate the exact dump entry.
 *
 * @example buildDumpIdPrefix('20260331215347', 'epbyminsd0654', 'E19', '00')
 *          // => '20260331215347epbyminsd0654_E19_00'
 */
function buildDumpIdPrefix(datetime, hostname, sysid, instance) {
    return `${datetime}${hostname}_${sysid}_${instance}`;
}
/**
 * Build ADT runtime dumps query expression for user filtering.
 *
 * @example and( equals( user, CB9980000423 ) )
 */
function buildRuntimeDumpsUserQuery(user) {
    const normalized = user?.trim();
    if (!normalized) {
        return undefined;
    }
    return `and( equals( user, ${normalized} ) )`;
}
/**
 * List runtime dumps feed.
 */
async function listRuntimeDumps(connection, options = {}) {
    const params = new URLSearchParams();
    appendIfDefined(params, '$query', options.query);
    appendIfDefined(params, '$inlinecount', options.inlinecount);
    appendIfDefined(params, '$top', options.top);
    appendIfDefined(params, '$skip', options.skip);
    appendIfDefined(params, '$orderby', options.orderby);
    appendIfDefined(params, 'from', options.from);
    appendIfDefined(params, 'to', options.to);
    const query = params.toString();
    const url = `/sap/bc/adt/runtime/dumps${query ? `?${query}` : ''}`;
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
 * List runtime dumps filtered by user.
 */
async function listRuntimeDumpsByUser(connection, user, options = {}) {
    return listRuntimeDumps(connection, {
        ...options,
        query: buildRuntimeDumpsUserQuery(user),
    });
}
/**
 * Read a specific runtime dump by its dump ID.
 */
async function getRuntimeDumpById(connection, dumpId, options = {}) {
    const normalized = normalizeDumpId(dumpId);
    const view = options.view || 'default';
    const suffix = view === 'summary' ? '/summary' : view === 'formatted' ? '/formatted' : '';
    const accept = view === 'summary'
        ? 'text/html'
        : view === 'formatted'
            ? 'text/plain'
            : 'application/vnd.sap.adt.runtime.dump.v1+xml';
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/runtime/dump/${normalized}${suffix}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: accept,
        },
    });
}
