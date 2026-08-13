"use strict";
/**
 * Domain lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireLockHandle = acquireLockHandle;
exports.lockDomain = lockDomain;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Acquire lock handle by attempting to lock the domain (for create)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function acquireLockHandle(connection, args) {
    const domainNameEncoded = (0, internalUtils_1.encodeSapObjectName)(args.domain_name.toLowerCase());
    const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    try {
        const response = await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: null,
            headers,
        });
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const result = parser.parse(response.data);
        const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
        if (!lockHandle) {
            throw new Error('Failed to obtain lock handle from SAP response');
        }
        return lockHandle;
    }
    catch (error) {
        const e = error;
        if (typeof e.response?.data === 'string' &&
            e.response.data.includes('ExceptionResourceAlreadyExists')) {
            throw new Error(`Domain ${args.domain_name} already exists. Please delete it first or use a different name.`);
        }
        throw new Error(`Failed to create empty domain ${args.domain_name}: ${e.message || error}`);
    }
}
/**
 * Lock domain for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function lockDomain(connection, domainName) {
    const domainNameEncoded = (0, internalUtils_1.encodeSapObjectName)(domainName.toLowerCase());
    const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
        headers,
    });
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to extract lock handle from response');
    }
    return lockHandle;
}
