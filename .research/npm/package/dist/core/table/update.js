"use strict";
/**
 * Table update operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTable = updateTable;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update table using existing lock/session (Builder workflow)
 */
async function updateTable(connection, params, lockHandle) {
    if (!params.table_name) {
        throw new Error('table_name is required');
    }
    if (!params.ddl_code) {
        throw new Error('ddl_code is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const tableName = params.table_name.toUpperCase();
    const queryParams = `lockHandle=${encodeURIComponent(lockHandle)}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;
    const url = `/sap/bc/adt/ddic/tables/${(0, internalUtils_1.encodeSapObjectName)(tableName).toLowerCase()}/source/main?${queryParams}`;
    const headers = {
        'Content-Type': contentTypes_1.CT_SOURCE,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: params.ddl_code,
        headers,
    });
}
