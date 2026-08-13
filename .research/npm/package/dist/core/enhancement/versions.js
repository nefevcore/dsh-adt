"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnhancementVersions = getEnhancementVersions;
exports.getEnhancementVersionSource = getEnhancementVersionSource;
const timeouts_1 = require("../../utils/timeouts");
const versions_1 = require("../shared/versions");
const types_1 = require("./types");
const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';
// candidate URI — probe-verify on trial
async function getEnhancementVersions(connection, config) {
    if (!config.enhancementName)
        throw new Error('enhancementName is required');
    if (!config.enhancementType)
        throw new Error('enhancementType is required');
    const url = `${(0, types_1.getEnhancementUri)(config.enhancementType, config.enhancementName)}/source/main/versions`;
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
        (0, versions_1.throwVersionsError)(e, `enhancement ${config.enhancementName}`);
    }
}
async function getEnhancementVersionSource(connection, contentUri) {
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
