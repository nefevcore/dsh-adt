"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pullRepo = pullRepo;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const getErrorLog_1 = require("./getErrorLog");
const listRepos_1 = require("./listRepos");
const poll_1 = require("./poll");
const xmlBuilder_1 = require("./xmlBuilder");
async function pullRepo(connection, args, contentTypeVersion = 'v3') {
    const repos = await (0, listRepos_1.listRepos)(connection);
    const match = repos.find((r) => r.package.toUpperCase() === args.package.toUpperCase());
    if (!match) {
        throw new Error(`abapGit repository for package '${args.package}' not found`);
    }
    if (!match.atomLinks.pullLink) {
        throw new Error(`abapGit repository '${args.package}': response missing pull_link atom link`);
    }
    const resolvedBranch = args.branchName ?? match.branchName;
    const ct = contentTypeVersion === 'v4' ? contentTypes_1.CT_ABAPGIT_REPO_V4 : contentTypes_1.CT_ABAPGIT_REPO_V3;
    await connection.makeAdtRequest({
        method: 'POST',
        url: match.atomLinks.pullLink,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { 'Content-Type': ct, Accept: ct },
        data: (0, xmlBuilder_1.buildPullBody)(args, resolvedBranch),
    });
    const terminal = await (0, poll_1.pollUntilTerminal)(connection, args.package, {
        pollIntervalMs: args.pollIntervalMs,
        maxPollDurationMs: args.maxPollDurationMs,
        signal: args.signal,
        onProgress: args.onProgress,
    });
    const result = { finalStatus: terminal };
    if (terminal.status === 'E' || terminal.status === 'A') {
        try {
            result.errorLog = await (0, getErrorLog_1.getErrorLog)(connection, args.package);
        }
        catch {
            // Error log is best-effort. If it fails, return the result without it.
        }
    }
    return result;
}
