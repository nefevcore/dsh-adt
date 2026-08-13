/**
 * GatewayErrorLog - Domain object for /IWFND/ERROR_LOG
 *
 * Provides list and detail access to SAP Gateway error log entries.
 */
import type { IAbapConnection, IAdtResponse, IFeedQueryOptions, IGatewayErrorLog, ILogger } from '@mcp-abap-adt/interfaces';
export declare class GatewayErrorLog implements IGatewayErrorLog {
    private readonly connection;
    private readonly logger;
    readonly kind: "gatewayErrorLog";
    constructor(connection: IAbapConnection, logger: ILogger);
    list(options?: IFeedQueryOptions): Promise<IAdtResponse>;
    getById(errorType: string, errorId: string): Promise<IAdtResponse>;
}
//# sourceMappingURL=GatewayErrorLog.d.ts.map