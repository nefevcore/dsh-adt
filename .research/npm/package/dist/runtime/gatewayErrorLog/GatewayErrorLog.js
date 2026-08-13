"use strict";
/**
 * GatewayErrorLog - Domain object for /IWFND/ERROR_LOG
 *
 * Provides list and detail access to SAP Gateway error log entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayErrorLog = void 0;
const read_1 = require("./read");
class GatewayErrorLog {
    connection;
    logger;
    kind = 'gatewayErrorLog';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async list(options) {
        return (0, read_1.listGatewayErrors)(this.connection, options);
    }
    async getById(errorType, errorId) {
        return (0, read_1.getGatewayError)(this.connection, errorType, errorId);
    }
}
exports.GatewayErrorLog = GatewayErrorLog;
