"use strict";
/**
 * Package update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (abapLanguageVersion, etc.)
 * that would be lost if XML were built from scratch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePackage = updatePackage;
exports.updatePackageDescription = updatePackageDescription;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlPatch_1 = require("../../utils/xmlPatch");
/**
 * Patch current package XML with updated values.
 * Only modifies fields that are explicitly provided in args.
 */
function patchPackageXml(currentXml, args) {
    let xml = currentXml;
    // Read-modify-write: empty string means "don't change" — preserve value from GET.
    // Only non-empty values are patched into the XML.
    // Description (always provided for update)
    if (args.description) {
        const description = (0, internalUtils_1.limitDescription)(args.description);
        xml = (0, xmlPatch_1.patchXmlAttribute)(xml, 'adtcore:description', description);
    }
    // Responsible
    xml = (0, xmlPatch_1.patchIf)(xml, args.responsible || undefined, (x, val) => (0, xmlPatch_1.patchXmlAttribute)(x, 'adtcore:responsible', val));
    // Master system
    xml = (0, xmlPatch_1.patchIf)(xml, args.master_system || undefined, (x, val) => (0, xmlPatch_1.patchXmlAttribute)(x, 'adtcore:masterSystem', val));
    // Package type (pak:packageType attribute on pak:attributes element)
    xml = (0, xmlPatch_1.patchIf)(xml, args.package_type || undefined, (x, val) => (0, xmlPatch_1.patchXmlElementAttribute)(x, 'pak:attributes', 'pak:packageType', val));
    // Record changes
    if (args.record_changes !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElementAttribute)(xml, 'pak:attributes', 'pak:recordChanges', args.record_changes ? 'true' : 'false');
    }
    // Super package
    xml = (0, xmlPatch_1.patchIf)(xml, args.super_package || undefined, (x, val) => (0, xmlPatch_1.patchXmlElementAttribute)(x, 'pak:superPackage', 'adtcore:name', val));
    // Software component
    xml = (0, xmlPatch_1.patchIf)(xml, args.software_component || undefined, (x, val) => (0, xmlPatch_1.patchXmlElementAttribute)(x, 'pak:softwareComponent', 'pak:name', val));
    // Transport layer
    xml = (0, xmlPatch_1.patchIf)(xml, args.transport_layer || undefined, (x, val) => (0, xmlPatch_1.patchXmlElementAttribute)(x, 'pak:transportLayer', 'pak:name', val));
    return xml;
}
/**
 * Update package with new data (read-modify-write pattern)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function updatePackage(connection, params, lockHandle) {
    if (!params.package_name) {
        throw new Error('package_name is required');
    }
    const packageNameEncoded = (0, internalUtils_1.encodeSapObjectName)(params.package_name.toLowerCase());
    // 1. GET current XML
    const currentResponse = await connection.makeAdtRequest({
        url: `/sap/bc/adt/packages/${packageNameEncoded}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_PACKAGE },
    });
    const currentXml = (0, xmlPatch_1.extractXmlString)(currentResponse.data, `package ${params.package_name}`);
    // 2. Patch only changed fields
    const updatedXml = patchPackageXml(currentXml, params);
    // 3. PUT
    const corrNrParam = params.transport_request
        ? `&corrNr=${params.transport_request}`
        : '';
    const url = `/sap/bc/adt/packages/${packageNameEncoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
    const headers = {
        'Content-Type': contentTypes_1.CT_PACKAGE,
        Accept: contentTypes_1.ACCEPT_PACKAGE,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: updatedXml,
        headers,
    });
}
/**
 * Update only package description (safe update - only modifiable field)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function updatePackageDescription(connection, packageName, description, lockHandle, superPackage) {
    if (!packageName) {
        throw new Error('package_name is required');
    }
    if (!description) {
        throw new Error('description is required');
    }
    return updatePackage(connection, {
        package_name: packageName,
        description: (0, internalUtils_1.limitDescription)(description),
        super_package: superPackage || '',
        record_changes: false,
    }, lockHandle);
}
