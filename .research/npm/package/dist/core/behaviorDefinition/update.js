"use strict";
/**
 * Behavior Definition update operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.update = update;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update behavior definition source code
 *
 * Endpoint: PUT /sap/bc/adt/bo/behaviordefinitions/{name}/source/main?lockHandle={handle}
 *
 * Requires behavior definition to be locked first
 *
 * @param connection - ABAP connection instance
 * @param params - Update parameters
 * @returns Axios response with updated source code
 *
 * @example
 * ```typescript
 * const source = `managed implementation in class zbp_my_bdef unique;
 * strict ( 2 );
 *
 * define behavior for Z_MY_ENTITY
 * persistent table z_my_table
 * lock master
 * authorization master ( instance )
 * {
 *   create;
 *   update;
 *   delete;
 * }`;
 *
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * await update(connection, {
 *   name: 'Z_MY_BDEF',
 *   sourceCode: source,
 *   lockHandle,
 *   transportRequest: 'E19K905635'
 * });
 * await unlock(connection, 'Z_MY_BDEF', lockHandle, sessionId);
 * ```
 */
async function update(connection, params) {
    if (!params.sourceCode) {
        throw new Error('sourceCode is required');
    }
    if (!params.lockHandle) {
        throw new Error('lockHandle is required');
    }
    let url = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(params.name).toLowerCase()}/source/main?lockHandle=${encodeURIComponent(params.lockHandle)}`;
    if (params.transportRequest) {
        url += `&corrNr=${params.transportRequest}`;
    }
    const headers = {
        'Content-Type': contentTypes_1.CT_SOURCE,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: params.sourceCode,
        headers,
    });
}
