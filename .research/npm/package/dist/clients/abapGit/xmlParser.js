"use strict";
/**
 * XML parsers for abapGit responses.
 *
 * Uses fast-xml-parser (already a project dependency). Namespace
 * prefixes are stripped via removeNSPrefix; elements are indexed by
 * local name only. Element names and atom-link types below reflect
 * Phase Z live-probe findings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRepoList = parseRepoList;
exports.parseErrorLog = parseErrorLog;
exports.parseExternalRepoInfo = parseExternalRepoInfo;
const fast_xml_parser_1 = require("fast-xml-parser");
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    isArray: (name) => name === 'repository' ||
        name === 'abapObject' ||
        name === 'branch' ||
        name === 'link',
});
function asString(value) {
    if (value === undefined || value === null)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return '';
}
function parseAtomLinks(repoNode) {
    const links = Array.isArray(repoNode?.link) ? repoNode.link : [];
    const out = {};
    for (const link of links) {
        const type = asString(link?.type);
        const href = asString(link?.href);
        if (!href)
            continue;
        if (type === 'pull_link')
            out.pullLink = href;
        else if (type === 'log_link')
            out.logLink = href;
    }
    return out;
}
function parseRepoEntity(repoNode) {
    return {
        package: asString(repoNode?.package),
        url: asString(repoNode?.url),
        branchName: asString(repoNode?.branchName),
        status: asString(repoNode?.status),
        statusText: asString(repoNode?.statusText),
        createdBy: asString(repoNode?.createdBy) || undefined,
        createdAt: asString(repoNode?.createdAt) || undefined,
        repositoryId: asString(repoNode?.key) || undefined,
        atomLinks: parseAtomLinks(repoNode),
    };
}
function parseRepoList(xml) {
    const parsed = parser.parse(xml);
    // Phase Z confirmed root element name: 'repositories'.
    const repos = parsed?.repositories?.repository ?? [];
    return (Array.isArray(repos) ? repos : [repos])
        .filter(Boolean)
        .map(parseRepoEntity);
}
function parseErrorLog(xml) {
    const parsed = parser.parse(xml);
    const items = parsed?.abapObjects?.abapObject ?? [];
    return (Array.isArray(items) ? items : [items])
        .filter(Boolean)
        .map((o) => ({
        msgType: asString(o?.msgType),
        objectType: asString(o?.type),
        objectName: asString(o?.name),
        messageText: asString(o?.msgText),
    }));
}
function parseExternalRepoInfo(xml) {
    const parsed = parser.parse(xml);
    // Phase Z confirmed root: <abapgitexternalrepo:externalRepoInfo>.
    const root = parsed?.externalRepoInfo ?? {};
    const rawBranches = root?.branch ?? [];
    const branches = (Array.isArray(rawBranches) ? rawBranches : [rawBranches])
        .filter(Boolean)
        .map((b) => ({
        name: asString(b?.name),
        sha1: asString(b?.sha1),
        // SAP-XML boolean: 'X' = true, empty element = false.
        isHead: String(asString(b?.isHead)).toUpperCase() === 'X',
        type: asString(b?.type) || undefined,
    }));
    return {
        branches,
        accessMode: asString(root?.accessMode) || undefined,
    };
}
