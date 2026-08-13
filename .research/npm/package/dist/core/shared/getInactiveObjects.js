"use strict";
/**
 * Get Inactive Objects - retrieve list of objects not yet activated
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInactiveObjects = getInactiveObjects;
const fast_xml_parser_1 = require("fast-xml-parser");
const timeouts_1 = require("../../utils/timeouts");
const xmlParser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
});
/**
 * Get list of inactive objects (objects that are not yet activated)
 *
 * Endpoint: GET /sap/bc/adt/activation/inactiveobjects
 *
 * @param connection - ABAP connection instance
 * @param options - Optional parameters
 * @returns List of inactive objects with their metadata
 *
 * @example
 * ```typescript
 * const result = await getInactiveObjects(connection);
 *
 * // Objects can be directly passed to activateObjectsGroup
 * await activateObjectsGroup(connection, result.objects);
 * ```
 */
async function getInactiveObjects(connection, options) {
    const response = await connection.makeAdtRequest({
        method: 'GET',
        url: `/sap/bc/adt/activation/inactiveobjects`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
        },
    });
    const xml = response.data;
    const parsed = xmlParser.parse(xml);
    const objects = [];
    // Parse XML response
    const root = parsed['ioc:inactiveObjects'];
    if (!root) {
        return { objects, xmlStr: options?.includeRawXml ? xml : undefined };
    }
    const entries = Array.isArray(root['ioc:entry'])
        ? root['ioc:entry']
        : root['ioc:entry']
            ? [root['ioc:entry']]
            : [];
    for (const entry of entries) {
        const objectData = entry['ioc:object'];
        if (!objectData)
            continue;
        const ref = objectData['ioc:ref'];
        if (!ref)
            continue;
        objects.push({
            type: ref['@_adtcore:type'] || '',
            name: ref['@_adtcore:name'] || '',
        });
    }
    return {
        objects,
        xmlStr: options?.includeRawXml ? xml : undefined,
    };
}
