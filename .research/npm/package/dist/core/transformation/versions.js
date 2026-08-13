"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransformationVersions = getTransformationVersions;
exports.getTransformationVersionSource = getTransformationVersionSource;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const versions_1 = require("../shared/versions");
const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';
// candidate URI — probe-verify on trial
async function getTransformationVersions(connection, config) {
    if (!config.transformationName)
        throw new Error('transformationName is required');
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(config.transformationName.toLowerCase());
    const url = `/sap/bc/adt/xslt/transformations/${encodedName}/source/main/versions`;
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
        (0, versions_1.throwVersionsError)(e, `transformation ${config.transformationName}`);
    }
}
async function getTransformationVersionSource(connection, contentUri) {
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
