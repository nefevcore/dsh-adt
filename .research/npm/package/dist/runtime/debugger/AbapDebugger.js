"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbapDebugger = void 0;
const abap_1 = require("./abap");
class AbapDebugger {
    connection;
    logger;
    kind = 'abapDebugger';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async launch(options) {
        return (0, abap_1.launchDebugger)(this.connection, options);
    }
    async stop(options) {
        return (0, abap_1.stopDebugger)(this.connection, options);
    }
    async get(options) {
        return (0, abap_1.getDebugger)(this.connection, options);
    }
    async getMemorySizes(includeAbap) {
        return (0, abap_1.getMemorySizes)(this.connection, includeAbap);
    }
    async getSystemArea(systemarea, options) {
        return (0, abap_1.getSystemArea)(this.connection, systemarea, options);
    }
    async synchronizeBreakpoints(checkConflict) {
        return (0, abap_1.synchronizeBreakpoints)(this.connection, checkConflict);
    }
    async getBreakpointStatements() {
        return (0, abap_1.getBreakpointStatements)(this.connection);
    }
    async getBreakpointMessageTypes() {
        return (0, abap_1.getBreakpointMessageTypes)(this.connection);
    }
    async getBreakpointConditions() {
        return (0, abap_1.getBreakpointConditions)(this.connection);
    }
    async validateBreakpoints() {
        return (0, abap_1.validateBreakpoints)(this.connection);
    }
    async getVitBreakpoints() {
        return (0, abap_1.getVitBreakpoints)(this.connection);
    }
    async getVariableMaxLength(variableName, part, maxLength) {
        return (0, abap_1.getVariableMaxLength)(this.connection, variableName, part, maxLength);
    }
    async getVariableSubcomponents(variableName, part, component, line) {
        return (0, abap_1.getVariableSubcomponents)(this.connection, variableName, part, component, line);
    }
    async getVariableAsCsv(variableName, part, options) {
        return (0, abap_1.getVariableAsCsv)(this.connection, variableName, part, options);
    }
    async getVariableAsJson(variableName, part, options) {
        return (0, abap_1.getVariableAsJson)(this.connection, variableName, part, options);
    }
    async getVariableValueStatement(variableName, part, options) {
        return (0, abap_1.getVariableValueStatement)(this.connection, variableName, part, options);
    }
    async executeAction(action, value) {
        return (0, abap_1.executeDebuggerAction)(this.connection, action, value);
    }
    async getCallStack() {
        return (0, abap_1.getCallStack)(this.connection);
    }
    async insertWatchpoint(variableName, condition) {
        return (0, abap_1.insertWatchpoint)(this.connection, variableName, condition);
    }
    async getWatchpoints() {
        return (0, abap_1.getWatchpoints)(this.connection);
    }
    async executeBatchRequest(requests) {
        return (0, abap_1.executeBatchRequest)(this.connection, requests);
    }
    buildBatchPayload(requests) {
        return (0, abap_1.buildDebuggerBatchPayload)(requests);
    }
    buildStepWithStackBatchPayload(stepMethod) {
        return (0, abap_1.buildDebuggerStepWithStackBatchPayload)(stepMethod);
    }
    async executeStepBatch(stepMethod) {
        return (0, abap_1.executeDebuggerStepBatch)(this.connection, stepMethod);
    }
    async stepIntoBatch() {
        return (0, abap_1.stepIntoDebuggerBatch)(this.connection);
    }
    async stepOutBatch() {
        return (0, abap_1.stepOutDebuggerBatch)(this.connection);
    }
    async stepContinueBatch() {
        return (0, abap_1.stepContinueDebuggerBatch)(this.connection);
    }
}
exports.AbapDebugger = AbapDebugger;
