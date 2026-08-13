"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = check;
exports.checkImplementation = checkImplementation;
exports.checkAbap = checkAbap;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Run check on behavior definition
 *
 * Endpoint: POST /sap/bc/adt/checkruns?reporters={reporter}
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param reporter - Check reporter type
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check (will be base64 encoded)
 * @returns Axios response with check results (XML)
 *
 * @example
 * ```typescript
 * // Check saved version
 * const implResult = await check(connection, 'Z_MY_BDEF', 'bdefImplementationCheck', sessionId);
 *
 * // Check unsaved source code
 * const syntaxResult = await check(connection, 'Z_MY_BDEF', 'abapCheckRun', sessionId, 'inactive', sourceCode);
 * ```
 */
async function check(connection, name, reporter, _sessionId, version = 'inactive', sourceCode) {
    let xmlBody;
    if (sourceCode) {
        // Check with source code content (for unsaved changes)
        // TODO: analyze whether chkrun:contentType can be extracted to a constant
        const base64Content = Buffer.from(sourceCode, 'utf-8').toString('base64');
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}" chkrun:version="${version}">
        <chkrun:artifacts>
            <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}/source/main">
                <chkrun:content>${base64Content}</chkrun:content>
            </chkrun:artifact>
        </chkrun:artifacts>
    </chkrun:checkObject>
</chkrun:checkObjectList>`;
    }
    else {
        // Check saved version
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
    }
    const headers = {
        Accept: contentTypes_1.ACCEPT_CHECK_MESSAGES,
        'Content-Type': contentTypes_1.CT_CHECK_OBJECTS,
    };
    const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
/**
 * Check behavior definition implementation
 *
 * Uses bdefImplementationCheck reporter
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Check unsaved changes
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
async function checkImplementation(connection, name, sessionId, version = 'inactive', sourceCode) {
    return check(connection, name, 'bdefImplementationCheck', sessionId, version, sourceCode);
}
/**
 * Check behavior definition ABAP syntax
 *
 * Uses abapCheckRun reporter
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Check unsaved changes
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
async function checkAbap(connection, name, sessionId, version = 'inactive', sourceCode) {
    return check(connection, name, 'abapCheckRun', sessionId, version, sourceCode);
}
