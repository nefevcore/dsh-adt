"use strict";
/**
 * Class test include operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockClassTestClasses = lockClassTestClasses;
exports.updateClassTestInclude = updateClassTestInclude;
exports.unlockClassTestClasses = unlockClassTestClasses;
exports.activateClassTestClasses = activateClassTestClasses;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock test classes for a class
 */
async function lockClassTestClasses(connection, className) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?_action=LOCK&accessMode=MODIFY`;
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
    const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to obtain lock handle for test classes. They may already be locked by another user.');
    }
    return lockHandle;
}
/**
 * Update test class source code
 */
async function updateClassTestInclude(connection, className, testClassSource, lockHandle, transportRequest) {
    if (!lockHandle) {
        throw new Error('lockHandle is required to update test classes');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (transportRequest) {
        url += `&corrNr=${transportRequest}`;
    }
    const headers = {
        'Content-Type': contentTypes_1.CT_SOURCE,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: testClassSource,
        headers,
    });
}
/**
 * Unlock test classes
 */
async function unlockClassTestClasses(connection, className, lockHandle) {
    if (!lockHandle) {
        throw new Error('lockHandle is required to unlock test classes');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
        headers,
    });
}
/**
 * Activate test classes
 */
async function activateClassTestClasses(connection, className, testClassName) {
    const encodedClass = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    const encodedTest = (0, internalUtils_1.encodeSapObjectName)(testClassName).toUpperCase();
    const objectUri = `/sap/bc/adt/oo/classes/${encodedClass}#testclass=${encodedTest}`;
    const objectName = `${className.toUpperCase()}#${encodedTest}`;
    return (0, activationUtils_1.activateObjectInSession)(connection, objectUri, objectName, true);
}
