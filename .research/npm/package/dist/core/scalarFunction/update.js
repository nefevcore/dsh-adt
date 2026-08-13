"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateScalarFunction = updateScalarFunction;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function updateScalarFunction(connection, args, lockHandle) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(args.scalar_function_name.toLowerCase());
    const corrNrParam = args.transport_request
        ? `&corrNr=${encodeURIComponent(args.transport_request)}`
        : '';
    const url = `/sap/bc/adt/ddic/dsfd/sources/${encoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: args.source_code,
        headers: { Accept: contentTypes_1.ACCEPT_SOURCE, 'Content-Type': contentTypes_1.CT_SOURCE },
    });
}
