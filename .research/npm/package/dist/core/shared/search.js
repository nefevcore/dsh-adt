"use strict";
/**
 * Search operations for ABAP objects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchObjects = searchObjects;
exports.parseSearchResults = parseSearchResults;
exports.searchObjectsTyped = searchObjectsTyped;
const fast_xml_parser_1 = require("fast-xml-parser");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Search for ABAP objects by name pattern
 *
 * @param connection - ABAP connection
 * @param params - Search parameters
 * @returns Search results
 */
async function searchObjects(connection, params) {
    const encodedQuery = (0, internalUtils_1.encodeSapObjectName)(params.query);
    const maxResults = params.maxResults || 100;
    let url = `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodedQuery}&maxResults=${maxResults}`;
    if (params.objectType) {
        url += `&objectType=${(0, internalUtils_1.encodeSapObjectName)(params.objectType)}`;
    }
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
const xmlParser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
});
/**
 * Read an attribute that ADT may or may not namespace-qualify.
 *
 * The quickSearch payload is not consistent across releases about whether the
 * objectReference attributes carry the `adtcore:` prefix, and the element
 * itself arrives unprefixed. Rather than pin one spelling and silently return
 * empty strings on a system that uses the other, try both.
 */
const attr = (node, name) => {
    const value = node[`@_adtcore:${name}`] ?? node[`@_${name}`];
    if (value === undefined || value === null) {
        return undefined;
    }
    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
};
const asArray = (value) => {
    if (!value)
        return [];
    return (Array.isArray(value) ? value : [value]);
};
/**
 * Parse a quickSearch response into typed hits.
 *
 * Exported so the raw `searchObjects` above stays available: a caller that
 * needs headers, status or the untouched XML keeps it, and a caller that just
 * wants the objects uses `searchObjectsTyped`. Removing the raw form would take
 * away a choice that costs us nothing to keep.
 */
function parseSearchResults(xml) {
    const parsed = xmlParser.parse(xml);
    const root = (parsed['adtcore:objectReferences'] ??
        parsed.objectReferences);
    if (!root) {
        return [];
    }
    const refs = asArray(root['adtcore:objectReference'] ?? root.objectReference);
    const results = [];
    for (const ref of refs) {
        const name = attr(ref, 'name');
        const type = attr(ref, 'type');
        // A hit without a name or a type cannot be acted on by a caller, and the
        // repository does not produce one; drop it rather than emit a half object.
        if (!name || !type) {
            continue;
        }
        results.push({
            name,
            type,
            description: attr(ref, 'description') ?? '',
            packageName: attr(ref, 'packageName'),
            uri: attr(ref, 'uri'),
        });
    }
    return results;
}
/** Search for ABAP objects and return the hits, parsed. */
async function searchObjectsTyped(connection, params) {
    const response = await searchObjects(connection, params);
    return parseSearchResults(String(response.data ?? ''));
}
