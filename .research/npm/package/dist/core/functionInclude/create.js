"use strict";
/**
 * FunctionInclude (FUGR/I) create operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
/**
 * Low-level: Create function include (POST to the parent group's includes collection).
 * Does NOT upload source / activate — just creates the include metadata.
 */
async function create(connection, args) {
    if (!args.function_group_name) {
        throw new Error('function_group_name is required');
    }
    if (!args.include_name) {
        throw new Error('include_name is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(args.function_group_name).toLowerCase();
    const url = `/sap/bc/adt/functions/groups/${groupLower}/includes${args.transport_request ? `?corrNr=${encodeURIComponent(args.transport_request)}` : ''}`;
    const xmlBody = (0, xmlBuilder_1.buildFunctionIncludeXml)(args);
    const headers = {
        Accept: contentTypes_1.ACCEPT_FUNCTION_INCLUDE,
        'Content-Type': contentTypes_1.CT_FUNCTION_INCLUDE,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
