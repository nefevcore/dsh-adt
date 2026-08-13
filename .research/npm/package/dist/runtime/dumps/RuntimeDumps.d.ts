import type { IAbapConnection, IAdtResponse, ILogger, IRuntimeDumpReadOptions, IRuntimeDumps, IRuntimeDumpsListOptions } from '@mcp-abap-adt/interfaces';
export declare class RuntimeDumps implements IRuntimeDumps {
    private readonly connection;
    private readonly logger;
    readonly kind: "runtimeDumps";
    constructor(connection: IAbapConnection, logger: ILogger);
    list(options?: IRuntimeDumpsListOptions): Promise<IAdtResponse>;
    listByUser(user?: string, options?: Omit<IRuntimeDumpsListOptions, 'query'>): Promise<IAdtResponse>;
    getById(dumpId: string, options?: IRuntimeDumpReadOptions): Promise<IAdtResponse>;
    buildIdPrefix(datetime: string, hostname: string, sysid: string, instance: string): string;
    buildUserQuery(user?: string): string | undefined;
}
//# sourceMappingURL=RuntimeDumps.d.ts.map