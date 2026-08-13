import type { IAbapConnection, IAdtResponse, IAmdpDebugger, IGetAmdpCellSubstringOptions, IGetAmdpDataPreviewOptions, ILogger, IStartAmdpDebuggerOptions } from '@mcp-abap-adt/interfaces';
/**
 * @experimental
 * AMDP debugger domain object — wraps all AMDP debugger and data preview operations.
 */
export declare class AmdpDebugger implements IAmdpDebugger {
    private readonly connection;
    private readonly logger;
    readonly kind: "amdpDebugger";
    constructor(connection: IAbapConnection, logger: ILogger);
    start(options?: IStartAmdpDebuggerOptions): Promise<IAdtResponse>;
    resume(mainId: string): Promise<IAdtResponse>;
    terminate(mainId: string, hardStop?: boolean): Promise<IAdtResponse>;
    getDebuggee(mainId: string, debuggeeId: string): Promise<IAdtResponse>;
    getVariable(mainId: string, debuggeeId: string, varname: string, offset?: number, length?: number): Promise<IAdtResponse>;
    setVariable(mainId: string, debuggeeId: string, varname: string, setNull?: boolean): Promise<IAdtResponse>;
    lookup(mainId: string, debuggeeId: string, name?: string): Promise<IAdtResponse>;
    stepOver(mainId: string, debuggeeId: string): Promise<IAdtResponse>;
    stepContinue(mainId: string, debuggeeId: string): Promise<IAdtResponse>;
    getBreakpoints(mainId: string): Promise<IAdtResponse>;
    getBreakpointsLlang(mainId: string): Promise<IAdtResponse>;
    getBreakpointsTableFunctions(mainId: string): Promise<IAdtResponse>;
    getDataPreview(options?: IGetAmdpDataPreviewOptions): Promise<IAdtResponse>;
    getCellSubstring(options?: IGetAmdpCellSubstringOptions): Promise<IAdtResponse>;
}
//# sourceMappingURL=AmdpDebugger.d.ts.map