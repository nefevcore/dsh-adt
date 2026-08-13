"use strict";
/**
 * FunctionInclude (FUGR/I) read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFunctionInclude = readFunctionInclude;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Read a function include (metadata only, no source).
 */
async function readFunctionInclude(connection, groupName, includeName, version = 'active', _options) {
    if (!groupName) {
        throw new Error('Function group name is required');
    }
    if (!includeName) {
        throw new Error('Include name is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    const params = new URLSearchParams();
    params.append('version', version);
    if (_options?.withLongPolling) {
        params.append('withLongPolling', 'true');
    }
    const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?${params.toString()}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_FUNCTION_INCLUDE,
        },
    });
}
