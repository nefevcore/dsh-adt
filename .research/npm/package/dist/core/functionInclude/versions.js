"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFunctionIncludeVersions = getFunctionIncludeVersions;
exports.getFunctionIncludeVersionSource = getFunctionIncludeVersionSource;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const versions_1 = require("../shared/versions");
const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';
// candidate URI — probe-verify on trial
async function getFunctionIncludeVersions(connection, config) {
    if (!config.functionGroupName)
        throw new Error('functionGroupName is required');
    if (!config.includeName)
        throw new Error('includeName is required');
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(config.functionGroupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(config.includeName.toUpperCase());
    const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}/versions`;
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
        (0, versions_1.throwVersionsError)(e, `function include ${config.includeName}`);
    }
}
async function getFunctionIncludeVersionSource(connection, contentUri) {
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
