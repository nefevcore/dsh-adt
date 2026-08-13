import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { type IClassExecutor, type IProgramExecutor } from '../executors';
export declare class AdtExecutor {
    private readonly connection;
    private readonly logger?;
    constructor(connection: IAbapConnection, logger?: ILogger);
    getClassExecutor(): IClassExecutor;
    getProgramExecutor(): IProgramExecutor;
}
//# sourceMappingURL=AdtExecutor.d.ts.map