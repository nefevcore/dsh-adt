"use strict";
/**
 * FunctionInclude (FUGR/I) source read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFunctionIncludeSource = readFunctionIncludeSource;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Read function include source code.
 */
async function readFunctionIncludeSource(connection, groupName, includeName, version = 'active') {
    if (!groupName) {
        throw new Error('Function group name is required');
    }
    if (!includeName) {
        throw new Error('Include name is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}/source/main?version=${encodeURIComponent(version)}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_SOURCE,
        },
    });
}
