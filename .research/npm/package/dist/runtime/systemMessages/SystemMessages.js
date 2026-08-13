"use strict";
/**
 * SystemMessages - Domain object for SM02 system messages
 *
 * Provides list and detail access to system messages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMessages = void 0;
const read_1 = require("./read");
class SystemMessages {
    connection;
    logger;
    kind = 'systemMessages';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async list(options) {
        return (0, read_1.listSystemMessages)(this.connection, options);
    }
    async getById(messageId) {
        return (0, read_1.getSystemMessage)(this.connection, messageId);
    }
}
exports.SystemMessages = SystemMessages;
