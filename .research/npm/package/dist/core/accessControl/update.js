"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAccessControl = updateAccessControl;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update access control source code
 * Requires object to be locked first (lockHandle must be provided)
 */
async function updateAccessControl(connection, args, lockHandle) {
    const accessControlNameEncoded = (0, internalUtils_1.encodeSapObjectName)(args.access_control_name.toLowerCase());
    const corrNrParam = args.transport_request
        ? `&corrNr=${args.transport_request}`
        : '';
    const url = `/sap/bc/adt/acm/dcl/sources/${accessControlNameEncoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
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
