"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRepos = listRepos;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const xmlParser_1 = require("./xmlParser");
async function listRepos(connection) {
    const resp = await connection.makeAdtRequest({
        method: 'GET',
        url: '/sap/bc/adt/abapgit/repos',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_ABAPGIT_REPOS_V2 },
    });
    return (0, xmlParser_1.parseRepoList)(String(resp.data));
}
