"use strict";
/**
 * AdtRuntimeClient - Runtime Operations Client
 *
 * Provides access to runtime-related ADT operations through domain object factories:
 * - getProfiler() — Profiler traces
 * - getCrossTrace() — Cross trace analysis
 * - getSt05Trace() — ST05 performance traces
 * - getDebugger() — Composite debugger (ABAP, AMDP, memory snapshots)
 * - getApplicationLog() — Application log analysis
 * - getAtcLog() — ATC check failure and execution logs
 * - getDdicActivation() — DDIC activation graph
 * - getDumps() — Runtime dump analysis
 * - getFeeds() — Feed repository (list feeds, variants, parse Atom feeds)
 * - getSystemMessages() — System messages (SM02)
 * - getGatewayErrorLog() — Gateway error log (/IWFND/ERROR_LOG)
 *
 * Usage:
 * ```typescript
 * import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';
 *
 * const client = new AdtRuntimeClient(connection, logger);
 *
 * // Profiler traces
 * const traceFiles = await client.getProfiler().list();
 * const traceParams = await client.getProfiler().getParameters();
 *
 * // Debugging
 * await client.getDebugger().getAbap().launch({ debuggingMode: 'external' });
 * const callStack = await client.getDebugger().getAbap().getCallStack();
 *
 * // Logs
 * const appLog = await client.getApplicationLog().getObject('Z_MY_LOG');
 * const atcLogs = await client.getAtcLog().getCheckFailureLogs();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtRuntimeClient = void 0;
const ApplicationLog_1 = require("../runtime/applicationLog/ApplicationLog");
const AtcLog_1 = require("../runtime/atc/AtcLog");
const DdicActivation_1 = require("../runtime/ddic/DdicActivation");
const Debugger_1 = require("../runtime/debugger/Debugger");
const RuntimeDumps_1 = require("../runtime/dumps/RuntimeDumps");
const FeedRepository_1 = require("../runtime/feeds/FeedRepository");
const GatewayErrorLog_1 = require("../runtime/gatewayErrorLog/GatewayErrorLog");
const SystemMessages_1 = require("../runtime/systemMessages/SystemMessages");
const CrossTraceDomain_1 = require("../runtime/traces/CrossTraceDomain");
const ProfilerDomain_1 = require("../runtime/traces/ProfilerDomain");
const St05Trace_1 = require("../runtime/traces/St05Trace");
class AdtRuntimeClient {
    connection;
    logger;
    _profiler;
    _crossTrace;
    _st05Trace;
    _debugger;
    _applicationLog;
    _atcLog;
    _ddicActivation;
    _dumps;
    _feeds;
    _systemMessages;
    _gatewayErrorLog;
    constructor(connection, logger, options) {
        this.connection = connection;
        this.logger = logger ?? {
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
        };
        if (options?.enableAcceptCorrection !== undefined) {
            const { setAcceptCorrectionEnabled, wrapConnectionAcceptNegotiation, getAcceptCorrectionEnabled, } = require('../utils/acceptNegotiation');
            setAcceptCorrectionEnabled(options.enableAcceptCorrection);
            const shouldWrap = options.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
            if (shouldWrap) {
                wrapConnectionAcceptNegotiation(this.connection, this.logger);
            }
        }
        else {
            const { getAcceptCorrectionEnabled, wrapConnectionAcceptNegotiation, } = require('../utils/acceptNegotiation');
            if (getAcceptCorrectionEnabled()) {
                wrapConnectionAcceptNegotiation(this.connection, this.logger);
            }
        }
    }
    // ============================================================================
    // Domain Object Factories
    // ============================================================================
    getProfiler() {
        if (!this._profiler) {
            this._profiler = new ProfilerDomain_1.Profiler(this.connection, this.logger);
        }
        return this._profiler;
    }
    getCrossTrace() {
        if (!this._crossTrace) {
            this._crossTrace = new CrossTraceDomain_1.CrossTrace(this.connection, this.logger);
        }
        return this._crossTrace;
    }
    getSt05Trace() {
        if (!this._st05Trace) {
            this._st05Trace = new St05Trace_1.St05Trace(this.connection, this.logger);
        }
        return this._st05Trace;
    }
    getDebugger() {
        if (!this._debugger) {
            this._debugger = new Debugger_1.Debugger(this.connection, this.logger);
        }
        return this._debugger;
    }
    getApplicationLog() {
        if (!this._applicationLog) {
            this._applicationLog = new ApplicationLog_1.ApplicationLog(this.connection, this.logger);
        }
        return this._applicationLog;
    }
    getAtcLog() {
        if (!this._atcLog) {
            this._atcLog = new AtcLog_1.AtcLog(this.connection, this.logger);
        }
        return this._atcLog;
    }
    getDdicActivation() {
        if (!this._ddicActivation) {
            this._ddicActivation = new DdicActivation_1.DdicActivation(this.connection, this.logger);
        }
        return this._ddicActivation;
    }
    getDumps() {
        if (!this._dumps) {
            this._dumps = new RuntimeDumps_1.RuntimeDumps(this.connection, this.logger);
        }
        return this._dumps;
    }
    // ============================================================================
    // Feed, SystemMessages, GatewayErrorLog Factories
    // ============================================================================
    getFeeds() {
        if (!this._feeds) {
            this._feeds = new FeedRepository_1.FeedRepository(this.connection, this.logger);
        }
        return this._feeds;
    }
    getSystemMessages() {
        if (!this._systemMessages) {
            this._systemMessages = new SystemMessages_1.SystemMessages(this.connection, this.logger);
        }
        return this._systemMessages;
    }
    getGatewayErrorLog() {
        if (!this._gatewayErrorLog) {
            this._gatewayErrorLog = new GatewayErrorLog_1.GatewayErrorLog(this.connection, this.logger);
        }
        return this._gatewayErrorLog;
    }
}
exports.AdtRuntimeClient = AdtRuntimeClient;
