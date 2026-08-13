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
import type { IAbapConnection, IApplicationLog, IAtcLog, ICrossTrace, IDdicActivation, IDebugger, IFeedRepository, IGatewayErrorLog, ILogger, IProfiler, IRuntimeDumps, ISt05Trace, ISystemMessages } from '@mcp-abap-adt/interfaces';
export declare class AdtRuntimeClient {
    protected readonly connection: IAbapConnection;
    protected readonly logger: ILogger;
    private _profiler?;
    private _crossTrace?;
    private _st05Trace?;
    private _debugger?;
    private _applicationLog?;
    private _atcLog?;
    private _ddicActivation?;
    private _dumps?;
    private _feeds?;
    private _systemMessages?;
    private _gatewayErrorLog?;
    constructor(connection: IAbapConnection, logger?: ILogger, options?: {
        enableAcceptCorrection?: boolean;
    });
    getProfiler(): IProfiler;
    getCrossTrace(): ICrossTrace;
    getSt05Trace(): ISt05Trace;
    getDebugger(): IDebugger;
    getApplicationLog(): IApplicationLog;
    getAtcLog(): IAtcLog;
    getDdicActivation(): IDdicActivation;
    getDumps(): IRuntimeDumps;
    getFeeds(): IFeedRepository;
    getSystemMessages(): ISystemMessages;
    getGatewayErrorLog(): IGatewayErrorLog;
}
//# sourceMappingURL=AdtRuntimeClient.d.ts.map