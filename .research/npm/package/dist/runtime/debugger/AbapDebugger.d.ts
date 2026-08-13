import type { IAbapConnection, IAbapDebugger, IAbapDebuggerStepMethod, IAdtResponse, IGetDebuggerOptions, IGetSystemAreaOptions, IGetVariableAsCsvOptions, IGetVariableAsJsonOptions, IGetVariableValueStatementOptions, ILaunchDebuggerOptions, ILogger, IStopDebuggerOptions } from '@mcp-abap-adt/interfaces';
import { type IDebuggerBatchPayload } from './abap';
export declare class AbapDebugger implements IAbapDebugger {
    private readonly connection;
    private readonly logger;
    readonly kind: "abapDebugger";
    constructor(connection: IAbapConnection, logger: ILogger);
    launch(options?: ILaunchDebuggerOptions): Promise<IAdtResponse>;
    stop(options?: IStopDebuggerOptions): Promise<IAdtResponse>;
    get(options?: IGetDebuggerOptions): Promise<IAdtResponse>;
    getMemorySizes(includeAbap?: boolean): Promise<IAdtResponse>;
    getSystemArea(systemarea: string, options?: IGetSystemAreaOptions): Promise<IAdtResponse>;
    synchronizeBreakpoints(checkConflict?: boolean): Promise<IAdtResponse>;
    getBreakpointStatements(): Promise<IAdtResponse>;
    getBreakpointMessageTypes(): Promise<IAdtResponse>;
    getBreakpointConditions(): Promise<IAdtResponse>;
    validateBreakpoints(): Promise<IAdtResponse>;
    getVitBreakpoints(): Promise<IAdtResponse>;
    getVariableMaxLength(variableName: string, part: string, maxLength?: number): Promise<IAdtResponse>;
    getVariableSubcomponents(variableName: string, part: string, component?: string, line?: number): Promise<IAdtResponse>;
    getVariableAsCsv(variableName: string, part: string, options?: IGetVariableAsCsvOptions): Promise<IAdtResponse>;
    getVariableAsJson(variableName: string, part: string, options?: IGetVariableAsJsonOptions): Promise<IAdtResponse>;
    getVariableValueStatement(variableName: string, part: string, options?: IGetVariableValueStatementOptions): Promise<IAdtResponse>;
    executeAction(action: string, value?: string): Promise<IAdtResponse>;
    getCallStack(): Promise<IAdtResponse>;
    insertWatchpoint(variableName: string, condition?: string): Promise<IAdtResponse>;
    getWatchpoints(): Promise<IAdtResponse>;
    executeBatchRequest(requests: string): Promise<IAdtResponse>;
    buildBatchPayload(requests: string[]): IDebuggerBatchPayload;
    buildStepWithStackBatchPayload(stepMethod: IAbapDebuggerStepMethod): IDebuggerBatchPayload;
    executeStepBatch(stepMethod: IAbapDebuggerStepMethod): Promise<IAdtResponse>;
    stepIntoBatch(): Promise<IAdtResponse>;
    stepOutBatch(): Promise<IAdtResponse>;
    stepContinueBatch(): Promise<IAdtResponse>;
}
//# sourceMappingURL=AbapDebugger.d.ts.map