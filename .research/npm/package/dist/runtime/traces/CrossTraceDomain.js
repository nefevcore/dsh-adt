"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossTrace = void 0;
const crossTrace_1 = require("./crossTrace");
class CrossTrace {
    connection;
    logger;
    kind = 'crossTrace';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async list(options) {
        return (0, crossTrace_1.listCrossTraces)(this.connection, options);
    }
    async getById(traceId, includeSensitiveData) {
        return (0, crossTrace_1.getCrossTrace)(this.connection, traceId, includeSensitiveData);
    }
    async getRecords(traceId) {
        return (0, crossTrace_1.getCrossTraceRecords)(this.connection, traceId);
    }
    async getRecordContent(traceId, recordNumber) {
        return (0, crossTrace_1.getCrossTraceRecordContent)(this.connection, traceId, recordNumber);
    }
    async getActivations() {
        return (0, crossTrace_1.getCrossTraceActivations)(this.connection);
    }
}
exports.CrossTrace = CrossTrace;
