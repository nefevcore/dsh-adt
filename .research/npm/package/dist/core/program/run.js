"use strict";
/**
 * Program run operations - execute ABAP executable programs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProgram = runProgram;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Run an ABAP executable program.
 *
 * Endpoint: POST /sap/bc/adt/programs/programrun/{programName}
 */
async function runProgram(connection, programName, _sessionId) {
    if (!programName?.trim()) {
        throw new Error('programName is required');
    }
    const normalizedName = (0, internalUtils_1.encodeSapObjectName)(programName).toUpperCase();
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/programs/programrun/${normalizedName}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_SOURCE,
            'X-sap-adt-profiling': 'server-time',
        },
    });
}
