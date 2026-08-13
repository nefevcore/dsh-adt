"use strict";
/**
 * TableType update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (valueHelps, etc.)
 * that would be lost if XML were built from scratch.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTableType = updateTableType;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlPatch_1 = require("../../utils/xmlPatch");
/**
 * Patch current table type XML with updated values.
 * Only modifies fields that are explicitly provided in params.
 */
function patchTableTypeXml(currentXml, params) {
    let xml = currentXml;
    // Description
    if (params.description) {
        const description = (0, internalUtils_1.limitDescription)(params.description);
        xml = (0, xmlPatch_1.patchXmlAttribute)(xml, 'adtcore:description', description);
    }
    // Row type
    xml = (0, xmlPatch_1.patchIf)(xml, params.row_type_kind, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'ttyp:typeKind', val));
    xml = (0, xmlPatch_1.patchIf)(xml, params.row_type_name, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'ttyp:typeName', val.toUpperCase()));
    // Access type
    xml = (0, xmlPatch_1.patchIf)(xml, params.access_type, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'ttyp:accessType', val));
    // Primary key
    xml = (0, xmlPatch_1.patchIf)(xml, params.primary_key_definition, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'ttyp:definition', val));
    xml = (0, xmlPatch_1.patchIf)(xml, params.primary_key_kind, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'ttyp:kind', val));
    return xml;
}
/**
 * Update table type using existing lock/session (read-modify-write pattern)
 */
async function updateTableType(connection, params, lockHandle, logger) {
    if (!params.tabletype_name) {
        throw new Error('tabletype_name is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const tableTypeName = params.tabletype_name.toUpperCase();
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableTypeName).toLowerCase();
    const queryParams = `lockHandle=${encodeURIComponent(lockHandle)}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;
    const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}?${queryParams}`;
    // 1. GET current XML
    const { getTableTypeMetadata } = await Promise.resolve().then(() => __importStar(require('./read')));
    const currentResponse = await getTableTypeMetadata(connection, tableTypeName, undefined, logger);
    const currentXml = (0, xmlPatch_1.extractXmlString)(currentResponse.data, `table type ${params.tabletype_name}`);
    // 2. Patch only changed fields
    const updatedXml = patchTableTypeXml(currentXml, params);
    // 3. PUT
    const headers = {
        Accept: contentTypes_1.CT_TABLE_TYPE,
        'Content-Type': contentTypes_1.CT_TABLE_TYPE,
    };
    try {
        return await connection.makeAdtRequest({
            url,
            method: 'PUT',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: updatedXml,
            headers,
        });
    }
    catch (error) {
        const e = error;
        const status = e.response?.status || 'unknown';
        const statusText = e.response?.statusText || '';
        const responseData = e.response?.data
            ? typeof e.response.data === 'string'
                ? e.response.data
                : JSON.stringify(e.response.data, null, 2)
            : e.message || 'No response data';
        const fullError = `Failed to update table type ${params.tabletype_name}: HTTP ${status} ${statusText} — ${responseData}`;
        logger?.error?.(fullError);
        throw new Error(fullError);
    }
}
