"use strict";
/**
 * View update operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDdl = updateDdl;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update view DDL source code
 * Low-level: Only uploads DDL source with lock handle, does NOT lock/unlock/activate
 * For complete workflow, use AdtDdl
 */
async function updateDdl(connection, ddlName, ddlSource, lockHandle, transportRequest) {
    const queryParams = `lockHandle=${encodeURIComponent(lockHandle)}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
    const url = `/sap/bc/adt/ddic/ddl/sources/${(0, internalUtils_1.encodeSapObjectName)(ddlName).toLowerCase()}/source/main?${queryParams}`;
    const headers = {
        'Content-Type': contentTypes_1.CT_SOURCE,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)(),
        data: ddlSource,
        headers,
    });
}
