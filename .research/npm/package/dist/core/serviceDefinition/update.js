"use strict";
/**
 * ServiceDefinition update operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateServiceDefinition = updateServiceDefinition;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update service definition source code
 * Requires object to be locked first (lockHandle must be provided)
 */
async function updateServiceDefinition(connection, args, lockHandle) {
    const serviceDefinitionNameEncoded = (0, internalUtils_1.encodeSapObjectName)(args.service_definition_name.toLowerCase());
    const corrNrParam = args.transport_request
        ? `&corrNr=${args.transport_request}`
        : '';
    const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_SOURCE,
        'Content-Type': contentTypes_1.CT_SOURCE,
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: args.source_code,
        headers,
    });
}
