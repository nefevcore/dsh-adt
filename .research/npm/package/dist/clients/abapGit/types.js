"use strict";
/**
 * abapGit client type definitions.
 *
 * Public surface (IAdtAbapGitClient) covers the ADT-integrated abapGit
 * (/sap/bc/adt/abapgit/*). link and pull match sapcli parity; unlink,
 * listRepos, getRepo, getErrorLog, and checkExternalRepo extend beyond
 * sapcli with discovery-evidenced endpoints.
 *
 * Pull is asynchronous server-side. The client-side wait loop respects
 * AbortSignal and a max-duration cap; aborting or timing out stops the
 * client wait only — the server-side job may still be running, and
 * callers must poll getRepo(package) until status != 'R' before
 * re-issuing pull or unlink.
 */
Object.defineProperty(exports, "__esModule", { value: true });
