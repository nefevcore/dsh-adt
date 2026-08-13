"use strict";
/**
 * Message class delete operations.
 *
 * Uses the stateless ADT deletion service (`/sap/bc/adt/deletion/check` +
 * `/sap/bc/adt/deletion/delete`) — the same mechanism Eclipse ADT and the other
 * object types (domain, serviceDefinition, …) use. A direct
 * `DELETE /messageclass/{name}?lockHandle=` leaves a lingering message-editing
 * enqueue ("User is currently editing …") that blocks a same-name re-create, so
 * it is NOT used here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteMessageClass = deleteMessageClass;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const BASE = '/sap/bc/adt/messageclass';
const objectUri = (name) => `${BASE}/${(0, internalUtils_1.encodeSapObjectName)(name.toLowerCase())}`;
/**
 * Low-level: check whether the message class can be deleted.
 * POST /sap/bc/adt/deletion/check
 */
async function checkDeletion(connection, name) {
    if (!name)
        throw new Error('name is required');
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(name)}"/>
</del:checkRequest>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/check',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION_CHECK,
            'Content-Type': contentTypes_1.CT_DELETION_CHECK,
        },
    });
}
/**
 * Low-level: delete the message class via the deletion service.
 * POST /sap/bc/adt/deletion/delete (stateless — no lock handle).
 *
 * For a transportable package pass `transportRequest` (emitted as
 * `<del:transportNumber>`), like domain; local packages send an empty tag.
 */
async function deleteMessageClass(connection, name, transportRequest) {
    if (!name)
        throw new Error('name is required');
    const transportNumberTag = transportRequest?.trim()
        ? `<del:transportNumber>${transportRequest}</del:transportNumber>`
        : '<del:transportNumber/>';
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(name)}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/delete',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION,
            'Content-Type': contentTypes_1.CT_DELETION,
        },
    });
}
