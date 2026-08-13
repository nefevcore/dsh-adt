"use strict";
/**
 * ServiceDefinition create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Low-level: Create service definition (POST)
 * Does NOT activate - just creates the object
 */
async function create(connection, args) {
    const url = `/sap/bc/adt/ddic/srvd/sources${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;
    const username = args.responsible || '';
    const masterSystem = args.masterSystem || '';
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(args.description || args.service_definition_name);
    const serviceDefinitionName = args.service_definition_name.toUpperCase();
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><srvd:srvdSource xmlns:srvd="http://www.sap.com/adt/ddic/srvdsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${serviceDefinitionName}" adtcore:type="SRVD/SRV" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr} adtcore:responsible="${username}" srvd:srvdSourceType="S">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</srvd:srvdSource>`;
    const headers = {
        Accept: contentTypes_1.CT_SERVICE_DEFINITION,
        'Content-Type': contentTypes_1.CT_SERVICE_DEFINITION,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
