"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.St05Trace = void 0;
const st05_1 = require("./st05");
class St05Trace {
    connection;
    logger;
    kind = 'st05Trace';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async getState() {
        return (0, st05_1.getSt05TraceState)(this.connection);
    }
    async getDirectory() {
        return (0, st05_1.getSt05TraceDirectory)(this.connection);
    }
}
exports.St05Trace = St05Trace;
