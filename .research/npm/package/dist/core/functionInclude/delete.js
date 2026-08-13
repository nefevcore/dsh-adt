"use strict";
/**
 * FunctionInclude (FUGR/I) delete operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteFunctionInclude = deleteFunctionInclude;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Parse a `del:deletionResult` and throw if the server did not delete.
 *
 * The ADT deletion service answers HTTP 200 even when it refuses to delete:
 * `<del:object del:isDeleted="false"><del:message del:type="E"><del:text>…`.
 * Some function-group includes can only be removed via the Function Builder, so
 * we MUST surface that instead of reporting a phantom success.
 */
function assertDeleted(responseData, includeName) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
    });
    let deleteObject;
    try {
        const result = parser.parse(String(responseData ?? ''));
        const deletionResult = (result['del:deletionResult'] ??
            result.deletionResult);
        deleteObject = (deletionResult?.['del:object'] ??
            deletionResult?.object);
    }
    catch {
        // Malformed/empty body — treat as a failed parse below.
        deleteObject = undefined;
    }
    const isDeleted = deleteObject?.['@_del:isDeleted'] === 'true' ||
        deleteObject?.['@_isDeleted'] === 'true';
    if (isDeleted) {
        return;
    }
    // `del:text` may be a plain string, or an object ({ '#text', atom:link }) when
    // the message carries a longtext link — normalize both to the text.
    const rawText = deleteObject?.['del:message']?.['del:text'] ??
        deleteObject?.message?.text;
    const message = typeof rawText === 'string'
        ? rawText
        : rawText?.['#text'];
    throw new Error(`Function include ${includeName} was not deleted${message ? `: ${message}` : ' (server reported isDeleted=false)'}`);
}
function objectUri(groupName, includeName) {
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    return `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}`;
}
/**
 * Low-level: Check if function include can be deleted.
 */
async function checkDeletion(connection, params) {
    if (!params.function_group_name) {
        throw new Error('function_group_name is required');
    }
    if (!params.include_name) {
        throw new Error('include_name is required');
    }
    const uri = objectUri(params.function_group_name, params.include_name);
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}"/>
</del:checkRequest>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/check',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION_CHECK,
            'Content-Type': contentTypes_1.CT_DELETION_CHECK,
        },
    });
}
/**
 * Low-level: Delete function include.
 */
async function deleteFunctionInclude(connection, params) {
    if (!params.function_group_name) {
        throw new Error('function_group_name is required');
    }
    if (!params.include_name) {
        throw new Error('include_name is required');
    }
    const uri = objectUri(params.function_group_name, params.include_name);
    const transportTag = params.transport_request?.trim()
        ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
        : '<del:transportNumber/>';
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}">
    ${transportTag}
  </del:object>
</del:deletionRequest>`;
    const response = await connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/delete',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION,
            'Content-Type': contentTypes_1.CT_DELETION,
        },
    });
    // The service returns HTTP 200 even when it refuses to delete; verify the
    // result element instead of assuming success.
    assertDeleted(response.data, params.include_name);
    return {
        ...response,
        data: {
            success: true,
            function_group_name: params.function_group_name,
            include_name: params.include_name,
            object_uri: uri,
            transport_request: params.transport_request || 'local',
            message: `Function include ${params.include_name} deleted successfully`,
        },
    };
}
