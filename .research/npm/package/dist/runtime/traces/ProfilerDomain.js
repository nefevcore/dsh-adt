"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Profiler = void 0;
const profiler_1 = require("./profiler");
class Profiler {
    connection;
    logger;
    kind = 'profiler';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async list(options) {
        return (0, profiler_1.listTraceFiles)(this.connection, options);
    }
    /** @deprecated Use list() instead */
    async listTraceFiles(options) {
        return this.list(options);
    }
    async getParameters() {
        return (0, profiler_1.getTraceParameters)(this.connection);
    }
    async getParametersForCallstack() {
        return (0, profiler_1.getTraceParametersForCallstack)(this.connection);
    }
    async getParametersForAmdp() {
        return (0, profiler_1.getTraceParametersForAmdp)(this.connection);
    }
    buildParametersXml(options) {
        return (0, profiler_1.buildTraceParametersXml)(options);
    }
    async createParameters(options) {
        return (0, profiler_1.createTraceParameters)(this.connection, options);
    }
    extractIdFromResponse(response) {
        return (0, profiler_1.extractProfilerIdFromResponse)(response);
    }
    getDefaultParameters() {
        return { ...profiler_1.DEFAULT_PROFILER_TRACE_PARAMETERS };
    }
    async getHitList(traceIdOrUri, options) {
        return (0, profiler_1.getTraceHitList)(this.connection, traceIdOrUri, options);
    }
    async getStatements(traceIdOrUri, options) {
        return (0, profiler_1.getTraceStatements)(this.connection, traceIdOrUri, options);
    }
    async getDbAccesses(traceIdOrUri, options) {
        return (0, profiler_1.getTraceDbAccesses)(this.connection, traceIdOrUri, options);
    }
    async listRequests() {
        return (0, profiler_1.listTraceRequests)(this.connection);
    }
    async getRequestsByUri(uri) {
        return (0, profiler_1.getTraceRequestsByUri)(this.connection, uri);
    }
    async listObjectTypes() {
        return (0, profiler_1.listObjectTypes)(this.connection);
    }
    async listProcessTypes() {
        return (0, profiler_1.listProcessTypes)(this.connection);
    }
}
exports.Profiler = Profiler;
