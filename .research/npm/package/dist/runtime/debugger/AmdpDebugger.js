"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmdpDebugger = void 0;
const amdp_1 = require("./amdp");
const amdpDataPreview_1 = require("./amdpDataPreview");
/**
 * @experimental
 * AMDP debugger domain object — wraps all AMDP debugger and data preview operations.
 */
class AmdpDebugger {
    connection;
    logger;
    kind = 'amdpDebugger';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async start(options) {
        return (0, amdp_1.startAmdpDebugger)(this.connection, options);
    }
    async resume(mainId) {
        return (0, amdp_1.resumeAmdpDebugger)(this.connection, mainId);
    }
    async terminate(mainId, hardStop) {
        return (0, amdp_1.terminateAmdpDebugger)(this.connection, mainId, hardStop);
    }
    async getDebuggee(mainId, debuggeeId) {
        return (0, amdp_1.getAmdpDebuggee)(this.connection, mainId, debuggeeId);
    }
    async getVariable(mainId, debuggeeId, varname, offset, length) {
        return (0, amdp_1.getAmdpVariable)(this.connection, mainId, debuggeeId, varname, offset, length);
    }
    async setVariable(mainId, debuggeeId, varname, setNull) {
        return (0, amdp_1.setAmdpVariable)(this.connection, mainId, debuggeeId, varname, setNull);
    }
    async lookup(mainId, debuggeeId, name) {
        return (0, amdp_1.lookupAmdp)(this.connection, mainId, debuggeeId, name);
    }
    async stepOver(mainId, debuggeeId) {
        return (0, amdp_1.stepOverAmdp)(this.connection, mainId, debuggeeId);
    }
    async stepContinue(mainId, debuggeeId) {
        return (0, amdp_1.stepContinueAmdp)(this.connection, mainId, debuggeeId);
    }
    async getBreakpoints(mainId) {
        return (0, amdp_1.getAmdpBreakpoints)(this.connection, mainId);
    }
    async getBreakpointsLlang(mainId) {
        return (0, amdp_1.getAmdpBreakpointsLlang)(this.connection, mainId);
    }
    async getBreakpointsTableFunctions(mainId) {
        return (0, amdp_1.getAmdpBreakpointsTableFunctions)(this.connection, mainId);
    }
    async getDataPreview(options) {
        return (0, amdpDataPreview_1.getAmdpDataPreview)(this.connection, options);
    }
    async getCellSubstring(options) {
        return (0, amdpDataPreview_1.getAmdpCellSubstring)(this.connection, options);
    }
}
exports.AmdpDebugger = AmdpDebugger;
