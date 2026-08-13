"use strict";
/**
 * Application Log Objects
 *
 * Provides functions for reading application log objects:
 * - Get application log object properties
 * - Get application log object source
 * - Validate application log object name
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApplicationLogObject = getApplicationLogObject;
exports.getApplicationLogSource = getApplicationLogSource;
exports.validateApplicationLogName = validateApplicationLogName;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get application log object properties
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name
 * @param options - Optional parameters
 * @returns Axios response with application log object properties
 */
async function getApplicationLogObject(connection, objectName, options) {
    const url = `/sap/bc/adt/applicationlog/objects/${objectName}`;
    const params = {};
    if (options?.corrNr)
        params.corrNr = options.corrNr;
    if (options?.lockHandle)
        params.lockHandle = options.lockHandle;
    if (options?.version)
        params.version = options.version;
    if (options?.accessMode)
        params.accessMode = options.accessMode;
    if (options?.action)
        params._action = options.action;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/properties',
        },
    });
}
/**
 * Get application log object source
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name
 * @param options - Optional parameters
 * @returns Axios response with application log object source
 */
async function getApplicationLogSource(connection, objectName, options) {
    const url = `/sap/bc/adt/applicationlog/objects/${objectName}/source/main`;
    const params = {};
    if (options?.corrNr)
        params.corrNr = options.corrNr;
    if (options?.lockHandle)
        params.lockHandle = options.lockHandle;
    if (options?.version)
        params.version = options.version;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/source',
        },
    });
}
/**
 * Validate application log object name
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name to validate
 * @returns Axios response with validation result
 */
async function validateApplicationLogName(connection, objectName) {
    const url = `/sap/bc/adt/applicationlog/objects/validation`;
    const params = {};
    // Note: According to the template, validation might need objectName as a parameter
    // Adjust based on actual ADT endpoint behavior
    params.objectName = objectName;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
        },
    });
}
