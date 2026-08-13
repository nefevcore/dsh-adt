"use strict";
/**
 * Package create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPackage = createPackage;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create ABAP package via single ADT POST (no validation or follow-up checks).
 */
async function createPackage(connection, params) {
    if (!params.package_name) {
        throw new Error('Package name is required');
    }
    const url = `/sap/bc/adt/packages`;
    const escapeXml = (str) => (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    // Description is limited to 60 characters in SAP ADT
    const description = escapeXml((0, internalUtils_1.limitDescription)(params.description || params.package_name));
    const packageType = params.package_type || 'development';
    const masterSystem = params.master_system;
    const lang = params.master_language?.trim() || 'EN';
    const responsibleUser = params.responsible || '';
    // Software component is required for package creation
    if (!params.software_component) {
        throw new Error('Software component is required for package creation');
    }
    const softwareComponentXml = `<pak:softwareComponent pak:name="${escapeXml(params.software_component)}"/>`;
    const transportLayerXml = params.transport_layer
        ? `<pak:transportLayer pak:name="${escapeXml(params.transport_layer)}"/>`
        : '<pak:transportLayer/>';
    const applicationComponentXml = params.application_component
        ? `<pak:applicationComponent pak:name="${escapeXml(params.application_component)}"/>`
        : '<pak:applicationComponent/>';
    const superPackageXml = params.super_package
        ? `<pak:superPackage adtcore:name="${escapeXml(params.super_package)}"/>`
        : '<pak:superPackage/>';
    const responsibleAttr = responsibleUser
        ? ` adtcore:responsible="${escapeXml(responsibleUser)}"`
        : '';
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${escapeXml(masterSystem)}"`
        : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<pak:package xmlns:pak="http://www.sap.com/adt/packages" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${escapeXml(params.package_name)}" adtcore:type="DEVC/K" adtcore:version="active" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${escapeXml(params.package_name)}"/>
  <pak:attributes pak:isEncapsulated="false" pak:packageType="${packageType}" pak:recordChanges="${params.record_changes ? 'true' : 'false'}"/>
  ${superPackageXml}
  ${applicationComponentXml}
  <pak:transport>
    ${softwareComponentXml}
    ${transportLayerXml}
  </pak:transport>
  <pak:translation/>
  <pak:useAccesses/>
  <pak:packageInterfaces/>
  <pak:subPackages/>
</pak:package>`;
    const fullUrl = params.transport_request
        ? `${url}?${(0, internalUtils_1.buildQueryString)({ corrNr: params.transport_request })}`
        : url;
    return connection.makeAdtRequest({
        url: fullUrl,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_PACKAGE,
            'Content-Type': contentTypes_1.CT_PACKAGE,
        },
    });
}
