/**
 * AdtAppendStructure - High-level CRUD for append structures (TABL/DS).
 * create() is metadata-only (requires baseObject); source via update().
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IAppendStructureConfig, IAppendStructureState } from './types';
export declare class AdtAppendStructure implements IAdtSourceObject<IAppendStructureConfig, IAppendStructureState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    validate(config: Partial<IAppendStructureConfig>): Promise<IAppendStructureState>;
    create(config: IAppendStructureConfig, _options?: IAdtOperationOptions): Promise<IAppendStructureState>;
    read(config: Partial<IAppendStructureConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAppendStructureState | undefined>;
    readMetadata(config: Partial<IAppendStructureConfig>, options?: IReadOptions): Promise<IAppendStructureState>;
    readTransport(config: Partial<IAppendStructureConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IAppendStructureState>;
    update(config: Partial<IAppendStructureConfig>, options?: IAdtOperationOptions): Promise<IAppendStructureState>;
    delete(config: Partial<IAppendStructureConfig>): Promise<IAppendStructureState>;
    activate(config: Partial<IAppendStructureConfig>): Promise<IAppendStructureState>;
    check(config: Partial<IAppendStructureConfig>, status?: string): Promise<IAppendStructureState>;
    lock(config: Partial<IAppendStructureConfig>): Promise<string>;
    unlock(config: Partial<IAppendStructureConfig>, lockHandle: string): Promise<IAppendStructureState>;
    getVersions(config: Partial<IAppendStructureConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtAppendStructure.d.ts.map