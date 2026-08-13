import type { IAbapConnection, IAbapDebugger, IAmdpDebugger, IDebugger, ILogger, IMemorySnapshots } from '@mcp-abap-adt/interfaces';
export declare class Debugger implements IDebugger {
    private readonly connection;
    private readonly logger;
    readonly kind: "debugger";
    private _abap?;
    private _amdp?;
    private _memorySnapshots?;
    constructor(connection: IAbapConnection, logger: ILogger);
    getAbap(): IAbapDebugger;
    getAmdp(): IAmdpDebugger;
    getMemorySnapshots(): IMemorySnapshots;
}
//# sourceMappingURL=Debugger.d.ts.map