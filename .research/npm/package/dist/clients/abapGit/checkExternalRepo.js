"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExternalRepo = checkExternalRepo;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
const xmlParser_1 = require("./xmlParser");
async function checkExternalRepo(connection, args) {
    // Phase Z confirmed: request/response use DIFFERENT media-type families.
    //   Content-Type = application/abapgit.adt.repo.info.ext.request.v2+xml
    //   Accept       = application/abapgit.adt.repo.info.ext.response.v2+xml
    const resp = await connection.makeAdtRequest({
        method: 'POST',
        url: '/sap/bc/adt/abapgit/externalrepoinfo',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            'Content-Type': contentTypes_1.CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2,
            Accept: contentTypes_1.ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2,
        },
        data: (0, xmlBuilder_1.buildExternalRepoInfoBody)(args),
    });
    return (0, xmlParser_1.parseExternalRepoInfo)(String(resp.data));
}
