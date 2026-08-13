"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassExecutor = void 0;
const run_1 = require("../../core/class/run");
const profiler_1 = require("../../runtime/traces/profiler");
const internalUtils_1 = require("../../utils/internalUtils");
const systemInfo_1 = require("../../utils/systemInfo");
const timeouts_1 = require("../../utils/timeouts");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class ClassExecutor {
    connection;
    logger;
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async run(target) {
        if (!target.className) {
            throw new Error('Class name is required');
        }
        return (0, run_1.runClass)(this.connection, target.className, true);
    }
    async runWithProfiler(target, options) {
        if (!target.className) {
            throw new Error('Class name is required');
        }
        if (!options.profilerId) {
            throw new Error('profilerId is required');
        }
        return this.runWithProfilerId(target.className, options.profilerId);
    }
    async runWithProfiling(target, options = {}) {
        if (!target.className) {
            throw new Error('Class name is required');
        }
        const parametersResponse = await (0, profiler_1.createTraceParameters)(this.connection, options.profilerParameters);
        const profilerId = (0, profiler_1.extractProfilerIdFromResponse)(parametersResponse);
        if (!profilerId) {
            throw new Error('Failed to extract profilerId from trace parameters response');
        }
        // Resolve current user for trace file lookup
        let userName;
        try {
            const sysInfo = await (0, systemInfo_1.getSystemInformation)(this.connection);
            userName = sysInfo?.userName;
        }
        catch {
            this.logger?.debug?.('Failed to resolve userName for trace lookup');
        }
        const response = await this.runWithProfilerId(target.className, profilerId);
        const maxAttempts = options.maxTraceAttempts ?? 5;
        const retryDelayMs = options.traceRetryDelayMs ?? 2000;
        const lookupUris = [
            ...(options.traceLookupUris ?? []),
            `/sap/bc/adt/oo/classrun/${target.className}`,
            `/sap/bc/adt/oo/classrun/${(0, internalUtils_1.encodeSapObjectName)(target.className).toUpperCase()}`,
        ];
        // SAP writes traces asynchronously — poll until the trace file appears
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this.logger?.debug?.(`Trace lookup attempt ${attempt}/${maxAttempts}`, {
                className: target.className,
                profilerId,
            });
            const result = await this.tryResolveTrace(lookupUris, profilerId, response, userName);
            if (result) {
                return result;
            }
            if (attempt < maxAttempts) {
                await delay(retryDelayMs);
            }
        }
        this.logger?.warn?.('Failed to resolve trace after all attempts', {
            className: target.className,
            profilerId,
            maxAttempts,
        });
        throw new Error(`Failed to resolve traceId after profiled execution for class ${target.className}`);
    }
    /**
     * Single attempt to find trace via trace files (filtered by user),
     * URI lookup, and trace requests fallback.
     */
    async tryResolveTrace(lookupUris, profilerId, runResponse, userName) {
        let traceRequestsResponse;
        // 1. Primary: list trace files filtered by user
        try {
            const filesResponse = await (0, profiler_1.listTraceFiles)(this.connection, userName ? { user: userName } : undefined);
            const traceId = (0, profiler_1.extractTraceIdFromTraceRequestsResponse)(filesResponse);
            if (traceId) {
                return {
                    response: runResponse,
                    profilerId,
                    traceId,
                    traceRequestsResponse: filesResponse,
                };
            }
        }
        catch (error) {
            this.logger?.debug?.('Trace files list failed', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        // 2. Fallback: lookup by URI
        for (const uri of lookupUris) {
            if (!uri) {
                continue;
            }
            try {
                const current = await (0, profiler_1.getTraceRequestsByUri)(this.connection, uri);
                const traceId = (0, profiler_1.extractTraceIdFromTraceRequestsResponse)(current);
                if (traceId) {
                    return {
                        response: runResponse,
                        profilerId,
                        traceId,
                        traceRequestsResponse: current,
                    };
                }
                traceRequestsResponse = current;
            }
            catch (error) {
                this.logger?.debug?.('Trace lookup by URI failed, trying next URI', {
                    uri,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        // 3. Fallback: list all trace requests
        try {
            const reqResponse = await (0, profiler_1.listTraceRequests)(this.connection);
            const traceId = (0, profiler_1.extractTraceIdFromTraceRequestsResponse)(reqResponse);
            if (traceId) {
                return {
                    response: runResponse,
                    profilerId,
                    traceId,
                    traceRequestsResponse: traceRequestsResponse ?? reqResponse,
                };
            }
        }
        catch (error) {
            this.logger?.debug?.('Trace requests list failed', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return undefined;
    }
    async runWithProfilerId(className, profilerId) {
        const encodedProfilerId = encodeURIComponent(profilerId);
        return this.connection.makeAdtRequest({
            url: `/sap/bc/adt/oo/classrun/${className}?profilerId=${encodedProfilerId}`,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: 'text/plain',
                'X-sap-adt-profiling': 'server-time',
            },
        });
    }
}
exports.ClassExecutor = ClassExecutor;
