"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassIncludeVersions = getClassIncludeVersions;
exports.getClassVersionSource = getClassVersionSource;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const versions_1 = require("../shared/versions");
const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';
async function getClassIncludeVersions(connection, className, includeType) {
    if (!className)
        throw new Error('className is required');
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/${includeType}/versions`;
    try {
        const res = await connection.makeAdtRequest({
            url,
            method: 'GET',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: { Accept: ACCEPT_VERSION_FEED },
        });
        return (0, versions_1.parseVersionsFeed)(String(res.data));
    }
    catch (e) {
        (0, versions_1.throwVersionsError)(e, `class ${className} (${includeType})`);
    }
}
async function getClassVersionSource(connection, contentUri) {
    try {
        const res = await connection.makeAdtRequest({
            url: contentUri,
            method: 'GET',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: { Accept: 'text/plain' },
        });
        return String(res.data);
    }
    catch (e) {
        (0, versions_1.throwVersionsError)(e, 'version content');
    }
}
