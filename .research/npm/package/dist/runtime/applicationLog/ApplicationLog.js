"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationLog = void 0;
const read_1 = require("./read");
class ApplicationLog {
    connection;
    logger;
    kind = 'applicationLog';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async getObject(objectName, options) {
        return (0, read_1.getApplicationLogObject)(this.connection, objectName, options);
    }
    async getSource(objectName, options) {
        return (0, read_1.getApplicationLogSource)(this.connection, objectName, options);
    }
    async validateName(objectName) {
        return (0, read_1.validateApplicationLogName)(this.connection, objectName);
    }
}
exports.ApplicationLog = ApplicationLog;
