/**
 * AdtScalarFunction - High-level CRUD for CDS scalar functions (DSFD/SCF).
 * Mirrors AdtServiceDefinition; create() is metadata-only, source via update().
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IScalarFunctionConfig, IScalarFunctionState } from './types';
export declare class AdtScalarFunction implements IAdtSourceObject<IScalarFunctionConfig, IScalarFunctionState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    validate(config: Partial<IScalarFunctionConfig>): Promise<IScalarFunctionState>;
    create(config: IScalarFunctionConfig, _options?: IAdtOperationOptions): Promise<IScalarFunctionState>;
    read(config: Partial<IScalarFunctionConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IScalarFunctionState | undefined>;
    readMetadata(config: Partial<IScalarFunctionConfig>, options?: IReadOptions): Promise<IScalarFunctionState>;
    readTransport(config: Partial<IScalarFunctionConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IScalarFunctionState>;
    update(config: Partial<IScalarFunctionConfig>, options?: IAdtOperationOptions): Promise<IScalarFunctionState>;
    delete(config: Partial<IScalarFunctionConfig>): Promise<IScalarFunctionState>;
    activate(config: Partial<IScalarFunctionConfig>): Promise<IScalarFunctionState>;
    check(config: Partial<IScalarFunctionConfig>, status?: string): Promise<IScalarFunctionState>;
    lock(config: Partial<IScalarFunctionConfig>): Promise<string>;
    unlock(config: Partial<IScalarFunctionConfig>, lockHandle: string): Promise<IScalarFunctionState>;
    getVersions(config: Partial<IScalarFunctionConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtScalarFunction.d.ts.map