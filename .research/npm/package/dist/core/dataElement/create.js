"use strict";
/**
 * DataElement create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 *
 * Create sends minimal XML (root element + packageRef only).
 * Type details (typeKind, labels, etc.) are set via update after creation,
 * matching Eclipse ADT behavior.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Low-level: Create data element (POST)
 * Does NOT activate - just creates the object with minimal metadata.
 * Type information and labels should be set via updateDataElement() afterwards.
 */
async function create(connection, args) {
    const url = `/sap/bc/adt/ddic/dataelements${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;
    const username = args.responsible || '';
    const masterSystem = args.masterSystem || '';
    const description = (0, internalUtils_1.limitDescription)(args.description || args.data_element_name);
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:wbobj xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${args.data_element_name.toUpperCase()}" adtcore:type="DTEL/DE" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</blue:wbobj>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_DATA_ELEMENT,
        'Content-Type': contentTypes_1.CT_DATA_ELEMENT,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
