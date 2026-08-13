"use strict";
/**
 * Domain create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create empty domain (initial POST to register the name)
 * Low-level function - creates domain without locking
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function create(connection, args) {
    const corrNrParam = args.transport_request
        ? `?corrNr=${args.transport_request}`
        : '';
    const url = `/sap/bc/adt/ddic/domains${corrNrParam}`;
    const masterSystem = args.masterSystem || '';
    const username = args.responsible || '';
    const description = (0, internalUtils_1.limitDescription)(args.description || args.domain_name);
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${args.domain_name.toUpperCase()}" adtcore:type="DOMA/DD" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</doma:domain>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_DOMAIN,
        'Content-Type': contentTypes_1.CT_DOMAIN,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
