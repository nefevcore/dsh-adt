"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeDumps = void 0;
const read_1 = require("./read");
class RuntimeDumps {
    connection;
    logger;
    kind = 'runtimeDumps';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async list(options) {
        return (0, read_1.listRuntimeDumps)(this.connection, options ?? {});
    }
    async listByUser(user, options) {
        return (0, read_1.listRuntimeDumpsByUser)(this.connection, user, options);
    }
    async getById(dumpId, options) {
        return (0, read_1.getRuntimeDumpById)(this.connection, dumpId, options);
    }
    buildIdPrefix(datetime, hostname, sysid, instance) {
        return (0, read_1.buildDumpIdPrefix)(datetime, hostname, sysid, instance);
    }
    buildUserQuery(user) {
        return (0, read_1.buildRuntimeDumpsUserQuery)(user);
    }
}
exports.RuntimeDumps = RuntimeDumps;
