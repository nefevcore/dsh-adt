"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorLog = getErrorLog;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const listRepos_1 = require("./listRepos");
const xmlParser_1 = require("./xmlParser");
async function getErrorLog(connection, packageName) {
    const repos = await (0, listRepos_1.listRepos)(connection);
    const match = repos.find((r) => r.package.toUpperCase() === packageName.toUpperCase());
    if (!match) {
        throw new Error(`abapGit repository for package '${packageName}' not found`);
    }
    if (!match.atomLinks.logLink) {
        return [];
    }
    const resp = await connection.makeAdtRequest({
        method: 'GET',
        url: match.atomLinks.logLink,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.CT_ABAPGIT_REPO_OBJECT_V2 },
    });
    return (0, xmlParser_1.parseErrorLog)(String(resp.data));
}
