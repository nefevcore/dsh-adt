"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgramExecutor = void 0;
const run_1 = require("../../core/program/run");
const profiler_1 = require("../../runtime/traces/profiler");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
class ProgramExecutor {
    connection;
    constructor(connection, _logger) {
        this.connection = connection;
    }
    async run(target) {
        if (!target.programName) {
            throw new Error('Program name is required');
        }
        return (0, run_1.runProgram)(this.connection, target.programName);
    }
    async runWithProfiler(target, options) {
        if (!target.programName) {
            throw new Error('Program name is required');
        }
        if (!options.profilerId) {
            throw new Error('profilerId is required');
        }
        return this.runWithProfilerId(target.programName, options.profilerId);
    }
    async runWithProfiling(target, options = {}) {
        if (!target.programName) {
            throw new Error('Program name is required');
        }
        const normalizedProgramName = (0, internalUtils_1.encodeSapObjectName)(target.programName).toUpperCase();
        const parametersResponse = await (0, profiler_1.createTraceParameters)(this.connection, options.profilerParameters);
        const profilerId = (0, profiler_1.extractProfilerIdFromResponse)(parametersResponse);
        if (!profilerId) {
            throw new Error('Failed to extract profilerId from trace parameters response');
        }
        const response = await this.runWithProfilerId(normalizedProgramName, profilerId);
        // Fire-and-forget: SAP writes the trace asynchronously after program completes.
        // The caller is responsible for polling RuntimeListProfilerTraceFiles to find the trace.
        return { response, profilerId };
    }
    async runWithProfilerId(programName, profilerId) {
        const normalizedProgramName = (0, internalUtils_1.encodeSapObjectName)(programName).toUpperCase();
        const encodedProfilerId = encodeURIComponent(profilerId);
        return this.connection.makeAdtRequest({
            url: `/sap/bc/adt/programs/programrun/${normalizedProgramName}?profilerId=${encodedProfilerId}`,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: 'text/plain',
                'X-sap-adt-profiling': 'server-time',
            },
        });
    }
}
exports.ProgramExecutor = ProgramExecutor;
