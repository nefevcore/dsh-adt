import type { IAbapConnection, IAdtResponse, ILogger, ISt05Trace } from '@mcp-abap-adt/interfaces';
export declare class St05Trace implements ISt05Trace {
    private readonly connection;
    private readonly logger;
    readonly kind: "st05Trace";
    constructor(connection: IAbapConnection, logger: ILogger);
    getState(): Promise<IAdtResponse>;
    getDirectory(): Promise<IAdtResponse>;
}
//# sourceMappingURL=St05Trace.d.ts.map