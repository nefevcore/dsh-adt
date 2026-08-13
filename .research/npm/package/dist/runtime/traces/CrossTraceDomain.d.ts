import type { IAbapConnection, IAdtResponse, ICrossTrace, IListCrossTracesOptions, ILogger } from '@mcp-abap-adt/interfaces';
export declare class CrossTrace implements ICrossTrace {
    private readonly connection;
    private readonly logger;
    readonly kind: "crossTrace";
    constructor(connection: IAbapConnection, logger: ILogger);
    list(options?: IListCrossTracesOptions): Promise<IAdtResponse>;
    getById(traceId: string, includeSensitiveData?: boolean): Promise<IAdtResponse>;
    getRecords(traceId: string): Promise<IAdtResponse>;
    getRecordContent(traceId: string, recordNumber: number): Promise<IAdtResponse>;
    getActivations(): Promise<IAdtResponse>;
}
//# sourceMappingURL=CrossTraceDomain.d.ts.map