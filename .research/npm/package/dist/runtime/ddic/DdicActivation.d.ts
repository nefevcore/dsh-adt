import type { IAbapConnection, IAdtResponse, IDdicActivation, IGetActivationGraphOptions, ILogger } from '@mcp-abap-adt/interfaces';
export declare class DdicActivation implements IDdicActivation {
    private readonly connection;
    private readonly logger;
    readonly kind: "ddicActivation";
    constructor(connection: IAbapConnection, logger: ILogger);
    getGraph(options?: IGetActivationGraphOptions): Promise<IAdtResponse>;
}
//# sourceMappingURL=DdicActivation.d.ts.map