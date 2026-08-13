import type { IAbapConnection, IAdtResponse, IApplicationLog, IGetApplicationLogObjectOptions, IGetApplicationLogSourceOptions, ILogger } from '@mcp-abap-adt/interfaces';
export declare class ApplicationLog implements IApplicationLog {
    private readonly connection;
    private readonly logger;
    readonly kind: "applicationLog";
    constructor(connection: IAbapConnection, logger: ILogger);
    getObject(objectName: string, options?: IGetApplicationLogObjectOptions): Promise<IAdtResponse>;
    getSource(objectName: string, options?: IGetApplicationLogSourceOptions): Promise<IAdtResponse>;
    validateName(objectName: string): Promise<IAdtResponse>;
}
//# sourceMappingURL=ApplicationLog.d.ts.map