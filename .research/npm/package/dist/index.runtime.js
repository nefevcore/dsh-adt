"use strict";
/**
 * ADT Clients — runtime barrel
 * Covers: AdtRuntimeClient, AdtRuntimeClientExperimental, and all runtime/** modules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.St05Trace = exports.Profiler = exports.CrossTrace = exports.SystemMessages = exports.MemorySnapshots = exports.GatewayErrorLog = exports.FeedRepository = exports.RuntimeDumps = exports.buildRuntimeDumpsUserQuery = exports.buildDumpIdPrefix = exports.Debugger = exports.AmdpDebugger = exports.AbapDebugger = exports.DdicActivation = exports.AtcLog = exports.ApplicationLog = exports.AdtRuntimeClientExperimental = exports.AdtRuntimeClient = void 0;
var AdtRuntimeClient_1 = require("./clients/AdtRuntimeClient");
Object.defineProperty(exports, "AdtRuntimeClient", { enumerable: true, get: function () { return AdtRuntimeClient_1.AdtRuntimeClient; } });
var AdtRuntimeClientExperimental_1 = require("./clients/AdtRuntimeClientExperimental");
Object.defineProperty(exports, "AdtRuntimeClientExperimental", { enumerable: true, get: function () { return AdtRuntimeClientExperimental_1.AdtRuntimeClientExperimental; } });
var ApplicationLog_1 = require("./runtime/applicationLog/ApplicationLog");
Object.defineProperty(exports, "ApplicationLog", { enumerable: true, get: function () { return ApplicationLog_1.ApplicationLog; } });
var AtcLog_1 = require("./runtime/atc/AtcLog");
Object.defineProperty(exports, "AtcLog", { enumerable: true, get: function () { return AtcLog_1.AtcLog; } });
var DdicActivation_1 = require("./runtime/ddic/DdicActivation");
Object.defineProperty(exports, "DdicActivation", { enumerable: true, get: function () { return DdicActivation_1.DdicActivation; } });
var AbapDebugger_1 = require("./runtime/debugger/AbapDebugger");
Object.defineProperty(exports, "AbapDebugger", { enumerable: true, get: function () { return AbapDebugger_1.AbapDebugger; } });
var AmdpDebugger_1 = require("./runtime/debugger/AmdpDebugger");
Object.defineProperty(exports, "AmdpDebugger", { enumerable: true, get: function () { return AmdpDebugger_1.AmdpDebugger; } });
var Debugger_1 = require("./runtime/debugger/Debugger");
Object.defineProperty(exports, "Debugger", { enumerable: true, get: function () { return Debugger_1.Debugger; } });
// Keep low-level dump types/functions (may be used by consumers)
var dumps_1 = require("./runtime/dumps");
Object.defineProperty(exports, "buildDumpIdPrefix", { enumerable: true, get: function () { return dumps_1.buildDumpIdPrefix; } });
Object.defineProperty(exports, "buildRuntimeDumpsUserQuery", { enumerable: true, get: function () { return dumps_1.buildRuntimeDumpsUserQuery; } });
var RuntimeDumps_1 = require("./runtime/dumps/RuntimeDumps");
Object.defineProperty(exports, "RuntimeDumps", { enumerable: true, get: function () { return RuntimeDumps_1.RuntimeDumps; } });
var FeedRepository_1 = require("./runtime/feeds/FeedRepository");
Object.defineProperty(exports, "FeedRepository", { enumerable: true, get: function () { return FeedRepository_1.FeedRepository; } });
var GatewayErrorLog_1 = require("./runtime/gatewayErrorLog/GatewayErrorLog");
Object.defineProperty(exports, "GatewayErrorLog", { enumerable: true, get: function () { return GatewayErrorLog_1.GatewayErrorLog; } });
// MemorySnapshots is now accessed via getDebugger().getMemorySnapshots()
// The class is still exported for backward compatibility
var MemorySnapshots_1 = require("./runtime/memory/MemorySnapshots");
Object.defineProperty(exports, "MemorySnapshots", { enumerable: true, get: function () { return MemorySnapshots_1.MemorySnapshots; } });
var SystemMessages_1 = require("./runtime/systemMessages/SystemMessages");
Object.defineProperty(exports, "SystemMessages", { enumerable: true, get: function () { return SystemMessages_1.SystemMessages; } });
var CrossTraceDomain_1 = require("./runtime/traces/CrossTraceDomain");
Object.defineProperty(exports, "CrossTrace", { enumerable: true, get: function () { return CrossTraceDomain_1.CrossTrace; } });
// Domain objects
var ProfilerDomain_1 = require("./runtime/traces/ProfilerDomain");
Object.defineProperty(exports, "Profiler", { enumerable: true, get: function () { return ProfilerDomain_1.Profiler; } });
var St05Trace_1 = require("./runtime/traces/St05Trace");
Object.defineProperty(exports, "St05Trace", { enumerable: true, get: function () { return St05Trace_1.St05Trace; } });
