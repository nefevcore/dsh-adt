"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtcLog = void 0;
const logs_1 = require("./logs");
class AtcLog {
    connection;
    logger;
    kind = 'atcLog';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async getCheckFailureLogs(options) {
        return (0, logs_1.getCheckFailureLogs)(this.connection, options);
    }
    async getExecutionLog(executionId) {
        return (0, logs_1.getExecutionLog)(this.connection, executionId);
    }
}
exports.AtcLog = AtcLog;
