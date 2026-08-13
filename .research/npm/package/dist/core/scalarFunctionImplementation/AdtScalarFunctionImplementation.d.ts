/**
 * AdtScalarFunctionImplementation - High-level CRUD for CDS scalar function implementations (DSFI/SFI).
 * Mirrors AdtScalarFunction; create() is metadata-only, source via update().
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IScalarFunctionImplementationConfig, IScalarFunctionImplementationState } from './types';
export declare class AdtScalarFunctionImplementation implements IAdtSourceObject<IScalarFunctionImplementationConfig, IScalarFunctionImplementationState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    validate(config: Partial<IScalarFunctionImplementationConfig>): Promise<IScalarFunctionImplementationState>;
    create(config: IScalarFunctionImplementationConfig, _options?: IAdtOperationOptions): Promise<IScalarFunctionImplementationState>;
    read(config: Partial<IScalarFunctionImplementationConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IScalarFunctionImplementationState | undefined>;
    readMetadata(config: Partial<IScalarFunctionImplementationConfig>, options?: IReadOptions): Promise<IScalarFunctionImplementationState>;
    readTransport(config: Partial<IScalarFunctionImplementationConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IScalarFunctionImplementationState>;
    /**
     * Update the implementation source (JSON) via PUT /source/main.
     * No check/long-poll/auto-activate — those don't apply to DSFI.
     * Trio activation (DSFD+AMDP+DSFI) is the consumer's responsibility.
     */
    update(config: Partial<IScalarFunctionImplementationConfig>, options?: IAdtOperationOptions): Promise<IScalarFunctionImplementationState>;
    /**
     * Update the metadata (blues v2 XML) via PUT /dsfi/{name}.
     * Same lock/unlock/finally-stateless hardening as update().
     */
    updateMetadata(config: Partial<IScalarFunctionImplementationConfig>, options?: IAdtOperationOptions): Promise<IScalarFunctionImplementationState>;
    delete(config: Partial<IScalarFunctionImplementationConfig>): Promise<IScalarFunctionImplementationState>;
    activate(config: Partial<IScalarFunctionImplementationConfig>): Promise<IScalarFunctionImplementationState>;
    check(config: Partial<IScalarFunctionImplementationConfig>, status?: string): Promise<IScalarFunctionImplementationState>;
    lock(config: Partial<IScalarFunctionImplementationConfig>): Promise<string>;
    unlock(config: Partial<IScalarFunctionImplementationConfig>, lockHandle: string): Promise<IScalarFunctionImplementationState>;
    getVersions(config: Partial<IScalarFunctionImplementationConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtScalarFunctionImplementation.d.ts.map