"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkRepo = linkRepo;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
async function linkRepo(connection, args, contentTypeVersion = 'v3') {
    const ct = contentTypeVersion === 'v4' ? contentTypes_1.CT_ABAPGIT_REPO_V4 : contentTypes_1.CT_ABAPGIT_REPO_V3;
    await connection.makeAdtRequest({
        method: 'POST',
        url: '/sap/bc/adt/abapgit/repos',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { 'Content-Type': ct, Accept: ct },
        data: (0, xmlBuilder_1.buildLinkBody)(args),
    });
}
