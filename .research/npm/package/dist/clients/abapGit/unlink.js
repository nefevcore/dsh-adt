"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlinkRepo = unlinkRepo;
const timeouts_1 = require("../../utils/timeouts");
const listRepos_1 = require("./listRepos");
async function unlinkRepo(connection, args) {
    const repos = await (0, listRepos_1.listRepos)(connection);
    const match = repos.find((r) => r.package.toUpperCase() === args.package.toUpperCase());
    if (!match) {
        throw new Error(`abapGit repository for package '${args.package}' not found`);
    }
    if (!match.repositoryId) {
        throw new Error(`abapGit repository '${args.package}': response missing <abapgitrepo:key>`);
    }
    const params = {};
    if (args.transportRequest)
        params.corrNr = args.transportRequest;
    await connection.makeAdtRequest({
        method: 'DELETE',
        url: `/sap/bc/adt/abapgit/repos/${encodeURIComponent(match.repositoryId)}`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
    });
}
