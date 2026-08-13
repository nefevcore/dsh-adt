"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVersionsFeed = parseVersionsFeed;
exports.throwUnsupportedVersions = throwUnsupportedVersions;
exports.throwVersionsError = throwVersionsError;
const interfaces_1 = require("@mcp-abap-adt/interfaces");
const fast_xml_parser_1 = require("fast-xml-parser");
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    parseTagValue: false,
});
/** Parse an ADT versions Atom feed into a list of versions. Pure — no endpoints. */
function parseVersionsFeed(xml) {
    const root = parser.parse(xml);
    const feed = root['atom:feed'] ?? root.feed;
    if (!feed)
        return [];
    const title = feed['atom:title'] ?? feed.title;
    const rawEntries = feed['atom:entry'] ?? feed.entry;
    const entries = Array.isArray(rawEntries)
        ? rawEntries
        : rawEntries
            ? [rawEntries]
            : [];
    return entries.map((e) => {
        const content = e['atom:content'] ?? e.content ?? {};
        const author = e['atom:author'] ?? e.author;
        const transport = extractTransport(e);
        return {
            versionId: String(e['atom:id'] ?? e.id ?? ''),
            author: author
                ? String(author['atom:name'] ?? author.name ?? '') || undefined
                : undefined,
            updatedAt: (e['atom:updated'] ?? e.updated)
                ? String(e['atom:updated'] ?? e.updated)
                : undefined,
            title: title ? String(title) : undefined,
            contentUri: String(content['@_src'] ?? ''),
            transportRequest: transport.request,
            transportDescription: transport.description,
        };
    });
}
const TRANSPORT_REL = 'http://www.sap.com/adt/relations/transport/request';
/** Pull the transport request (id + description) from a version entry's
 *  transport-request <atom:link>. An entry may carry two such links (sapgui +
 *  adt) with the same name — the first wins. Entries without a transport leave
 *  both undefined. */
function extractTransport(entry) {
    const raw = entry['atom:link'] ?? entry.link;
    const links = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const link = links.find((l) => l?.['@_rel'] === TRANSPORT_REL);
    if (!link)
        return {};
    const request = String(link['@_adtcore:name'] ?? '') || undefined;
    const description = String(link['@_title'] ?? '') || undefined;
    return { request, description };
}
/** Throw a typed "no version history" error. Used by non-source types and by
 *  source types when SAP reports the versions resource is absent (404/406). */
function throwUnsupportedVersions(detail) {
    const e = new interfaces_1.AdtOperationError(`Version history is not available${detail ? ` for ${detail}` : ''}`);
    e.code = interfaces_1.AdtObjectErrorCodes.UNSUPPORTED_OPERATION;
    throw e;
}
/** Translate ANY version-request failure into an interface-level error so no
 *  raw IAdtResponse/axios object ever leaks outward. 404/406 → unsupported;
 *  everything else → AdtOperationError carrying status + originalError.
 *  Call this from the catch of every version list/content GET. */
function throwVersionsError(error, detail) {
    const status = error?.response?.status ?? error?.status;
    if (status === 404 || status === 406) {
        throwUnsupportedVersions(detail);
    }
    const e = new interfaces_1.AdtOperationError(`Failed to read version history for ${detail}`);
    if (typeof status === 'number')
        e.status = status;
    e.originalError = error;
    throw e;
}
