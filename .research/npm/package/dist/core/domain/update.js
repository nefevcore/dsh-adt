"use strict";
/**
 * Domain update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDomain = updateDomain;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlPatch_1 = require("../../utils/xmlPatch");
/**
 * Patch current domain XML with updated values.
 * Only modifies fields that are explicitly provided in args.
 */
function patchDomainXml(currentXml, args) {
    let xml = currentXml;
    // Description
    if (args.description) {
        const description = (0, internalUtils_1.limitDescription)(args.description);
        xml = (0, xmlPatch_1.patchXmlAttribute)(xml, 'adtcore:description', description);
    }
    // Type information
    xml = (0, xmlPatch_1.patchIf)(xml, args.datatype, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'doma:datatype', val));
    xml = (0, xmlPatch_1.patchIf)(xml, args.length, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'doma:length', String(val)));
    xml = (0, xmlPatch_1.patchIf)(xml, args.decimals, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'doma:decimals', String(val)));
    // Output information
    if (args.conversion_exit !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'doma:conversionExit', args.conversion_exit || '');
    }
    if (args.sign_exists !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'doma:signExists', String(args.sign_exists));
    }
    if (args.lowercase !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'doma:lowercase', String(args.lowercase));
    }
    // Value table
    if (args.value_table !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElementAttribute)(xml, 'doma:valueTableRef', 'adtcore:name', args.value_table || '');
    }
    // Fixed values — replace entire block
    if (args.fixed_values !== undefined) {
        if (args.fixed_values && args.fixed_values.length > 0) {
            const fixValueItems = args.fixed_values
                .map((fv) => `      <doma:fixValue>\n        <doma:low>${fv.low}</doma:low>\n        <doma:text>${fv.text}</doma:text>\n      </doma:fixValue>`)
                .join('\n');
            const fixValuesBlock = `<doma:fixValues>\n${fixValueItems}\n    </doma:fixValues>`;
            xml = (0, xmlPatch_1.patchXmlBlock)(xml, 'doma:fixValues', fixValuesBlock);
        }
        else {
            xml = (0, xmlPatch_1.patchXmlBlock)(xml, 'doma:fixValues', '<doma:fixValues/>');
        }
    }
    return xml;
}
/**
 * Update domain with new data (read-modify-write pattern)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function updateDomain(connection, args, lockHandle) {
    const domainNameEncoded = (0, internalUtils_1.encodeSapObjectName)(args.domain_name.toLowerCase());
    // 1. GET current XML
    const currentResponse = await connection.makeAdtRequest({
        url: `/sap/bc/adt/ddic/domains/${domainNameEncoded}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_DOMAIN },
    });
    const currentXml = (0, xmlPatch_1.extractXmlString)(currentResponse.data, `domain ${args.domain_name}`);
    // 2. Patch only changed fields
    const updatedXml = patchDomainXml(currentXml, args);
    // 3. PUT
    const corrNrParam = args.transport_request
        ? `&corrNr=${args.transport_request}`
        : '';
    const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_DOMAIN,
        'Content-Type': 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: updatedXml,
        headers,
    });
}
