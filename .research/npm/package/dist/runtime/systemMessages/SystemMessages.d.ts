/**
 * SystemMessages - Domain object for SM02 system messages
 *
 * Provides list and detail access to system messages.
 */
import type { IAbapConnection, IAdtResponse, IFeedQueryOptions, ILogger, ISystemMessages } from '@mcp-abap-adt/interfaces';
export declare class SystemMessages implements ISystemMessages {
    private readonly connection;
    private readonly logger;
    readonly kind: "systemMessages";
    constructor(connection: IAbapConnection, logger: ILogger);
    list(options?: IFeedQueryOptions): Promise<IAdtResponse>;
    getById(messageId: string): Promise<IAdtResponse>;
}
//# sourceMappingURL=SystemMessages.d.ts.map