/**
 * Generic client for ABAP DDL source objects (`/sap/bc/adt/ddic/ddl/sources/`):
 * CDS views, AMDP table functions, and other DDL sources. Classic DDIC structures
 * (`/ddic/structures/`), tables (`/ddic/tables/`), and scalar functions
 * (`/ddic/dsfd/sources/`) have their own clients.
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 *
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IDdlConfig, IDdlState } from './types';
export declare class AdtDdl implements IAdtSourceObject<IDdlConfig, IDdlState> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate view configuration before creation
     */
    validate(config: Partial<IDdlConfig>): Promise<IDdlState>;
    /**
     * Create view with full operation chain
     */
    create(config: IDdlConfig, options?: IAdtOperationOptions): Promise<IDdlState>;
    /**
     * Read view
     */
    read(config: Partial<IDdlConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IDdlState | undefined>;
    /**
     * Read view metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IDdlConfig>, options?: IReadOptions): Promise<IDdlState>;
    /**
     * Read transport request information for the view
     */
    readTransport(config: Partial<IDdlConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IDdlState>;
    /**
     * Update view with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IDdlConfig>, options?: IAdtOperationOptions): Promise<IDdlState>;
    /**
     * Delete view
     */
    delete(config: Partial<IDdlConfig>): Promise<IDdlState>;
    /**
     * Activate view
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IDdlConfig>): Promise<IDdlState>;
    /**
     * Check view
     */
    check(config: Partial<IDdlConfig>, status?: string): Promise<IDdlState>;
    /**
     * Lock view for modification
     */
    lock(config: Partial<IDdlConfig>): Promise<string>;
    /**
     * Unlock view
     */
    unlock(config: Partial<IDdlConfig>, lockHandle: string): Promise<IDdlState>;
    getVersions(config: Partial<IDdlConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtDdl.d.ts.map