"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAppendStructureName = validateAppendStructureName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
async function validateAppendStructureName(connection, name, description) {
    const queryParams = new URLSearchParams({ objtype: 'tablds', objname: name });
    if (description)
        queryParams.append('description', description);
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/ddic/structures/validation?${queryParams.toString()}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_VALIDATION },
    });
}
