"use strict";
/**
 * ADT-integrated abapGit client.
 *
 * Standalone top-level class — NOT a factory on AdtClient (which is
 * reserved for IAdtObject<Config, State> implementations only).
 * Consumers instantiate directly: new AdtAbapGitClient(connection, logger, options).
 *
 * Implements IAdtAbapGitClient. HTTP operations are delegated to
 * low-level functions in ./abapGit/*; this class owns the options,
 * enforces the public contract, and keeps the call sites cast-free
 * by implementing the specialized interface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtAbapGitClient = void 0;
const checkExternalRepo_1 = require("./abapGit/checkExternalRepo");
const getErrorLog_1 = require("./abapGit/getErrorLog");
const link_1 = require("./abapGit/link");
const listRepos_1 = require("./abapGit/listRepos");
const pull_1 = require("./abapGit/pull");
const unlink_1 = require("./abapGit/unlink");
function toPublicRepoStatus(r) {
    return {
        package: r.package,
        url: r.url,
        branchName: r.branchName,
        status: r.status,
        statusText: r.statusText,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        repositoryId: r.repositoryId,
    };
}
class AdtAbapGitClient {
    connection;
    logger;
    contentTypeVersion;
    constructor(connection, logger, options) {
        this.connection = connection;
        this.logger = logger;
        this.contentTypeVersion = options?.contentTypeVersion ?? 'v3';
    }
    async link(args) {
        this.logger?.debug?.(`AdtAbapGitClient.link: package=${args.package} url=${args.url}`);
        await (0, link_1.linkRepo)(this.connection, args, this.contentTypeVersion);
    }
    async pull(args) {
        this.logger?.debug?.(`AdtAbapGitClient.pull: package=${args.package}`);
        return (0, pull_1.pullRepo)(this.connection, args, this.contentTypeVersion);
    }
    async unlink(args) {
        this.logger?.debug?.(`AdtAbapGitClient.unlink: package=${args.package}`);
        await (0, unlink_1.unlinkRepo)(this.connection, args);
    }
    async listRepos() {
        const rows = await (0, listRepos_1.listRepos)(this.connection);
        return rows.map(toPublicRepoStatus);
    }
    async getRepo(packageName) {
        const repos = await this.listRepos();
        return repos.find((r) => r.package.toUpperCase() === packageName.toUpperCase());
    }
    async getErrorLog(packageName) {
        return (0, getErrorLog_1.getErrorLog)(this.connection, packageName);
    }
    async checkExternalRepo(args) {
        return (0, checkExternalRepo_1.checkExternalRepo)(this.connection, args);
    }
}
exports.AdtAbapGitClient = AdtAbapGitClient;
