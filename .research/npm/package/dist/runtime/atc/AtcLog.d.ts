import type { IAbapConnection, IAdtResponse, IAtcLog, IGetCheckFailureLogsOptions, ILogger } from '@mcp-abap-adt/interfaces';
export declare class AtcLog implements IAtcLog {
    private readonly connection;
    private readonly logger;
    readonly kind: "atcLog";
    constructor(connection: IAbapConnection, logger: ILogger);
    getCheckFailureLogs(options?: IGetCheckFailureLogsOptions): Promise<IAdtResponse>;
    getExecutionLog(executionId: string): Promise<IAdtResponse>;
}
//# sourceMappingURL=AtcLog.d.ts.map