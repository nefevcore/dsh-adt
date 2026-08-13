"use strict";
/**
 * AuthorizationField (SUSO / AUTH) create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 * when the caller intends to keep the lock on the object for further updates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
/**
 * Low-level: Create authorization field (POST /sap/bc/adt/aps/iam/auth)
 */
async function create(connection, args) {
    if (!args.authorization_field_name) {
        throw new Error('authorization_field_name is required');
    }
    if (!args.package_name) {
        throw new Error('package_name is required');
    }
    const url = `/sap/bc/adt/aps/iam/auth${args.transport_request ? `?corrNr=${encodeURIComponent(args.transport_request)}` : ''}`;
    const xmlBody = (0, xmlBuilder_1.buildAuthorizationFieldXml)(args);
    const headers = {
        Accept: contentTypes_1.ACCEPT_AUTHORIZATION_FIELD,
        'Content-Type': contentTypes_1.CT_AUTHORIZATION_FIELD,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
