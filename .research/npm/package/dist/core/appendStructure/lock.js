"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockAppendStructure = lockAppendStructure;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function lockAppendStructure(connection, name) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const url = `/sap/bc/adt/ddic/structures/${encoded}?_action=LOCK&accessMode=MODIFY`;
    const response = await connection.makeAdtRequest({
        method: 'POST',
        url,
        headers: { Accept: contentTypes_1.ACCEPT_LOCK },
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle)
        throw new Error('Failed to extract lock handle from response');
    return lockHandle;
}
