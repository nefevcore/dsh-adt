"use strict";
/**
 * DataElement read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataElement = getDataElement;
exports.getDataElementTransport = getDataElementTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ABAP data element
 */
async function getDataElement(connection, dataElementName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(dataElementName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/dataelements/${encodedName}${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_DATA_ELEMENT,
        },
    });
}
/**
 * Get transport request for ABAP data element
 * @param connection - SAP connection
 * @param dataElementName - Data element name
 * @returns Transport request information
 */
async function getDataElementTransport(connection, dataElementName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(dataElementName);
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/dataelements/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
