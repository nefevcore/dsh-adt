"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtExecutor = void 0;
const executors_1 = require("../executors");
class AdtExecutor {
    connection;
    logger;
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    getClassExecutor() {
        return new executors_1.ClassExecutor(this.connection, this.logger);
    }
    getProgramExecutor() {
        return new executors_1.ProgramExecutor(this.connection, this.logger);
    }
}
exports.AdtExecutor = AdtExecutor;
