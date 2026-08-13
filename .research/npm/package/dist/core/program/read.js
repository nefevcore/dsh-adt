"use strict";
/**
 * Program read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgramMetadata = getProgramMetadata;
exports.getProgramSource = getProgramSource;
exports.getProgram = getProgram;
exports.getProgramTransport = getProgramTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const noopLogger_1 = require("../../utils/noopLogger");
const timeouts_1 = require("../../utils/timeouts");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection) {
    return new AdtUtils_1.AdtUtils(connection, noopLogger_1.noopLogger);
}
/**
 * Get ABAP program metadata (without source code)
 */
async function getProgramMetadata(connection, programName, options) {
    return getUtils(connection).readObjectMetadata('program', programName, undefined, options);
}
/**
 * Get ABAP program source code
 */
async function getProgramSource(connection, programName, version, options) {
    return getUtils(connection).readObjectSource('program', programName, undefined, version, options);
}
/**
 * Get ABAP program (source code by default for backward compatibility)
 * @deprecated Use getProgramSource() or getProgramMetadata() instead
 */
async function getProgram(connection, programName) {
    return getProgramSource(connection, programName);
}
/**
 * Get transport request for ABAP program
 * @param connection - SAP connection
 * @param programName - Program name
 * @returns Transport request information
 */
async function getProgramTransport(connection, programName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(programName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/programs/programs/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
