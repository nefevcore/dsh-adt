/**
 * AdtServiceDefinition - High-level CRUD operations for Service Definition (SRVD/SRV) objects
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
 * - Create: create (POST metadata only — creates an empty source; the source
 *   code is written by a subsequent update(), mirroring what Eclipse ADT does)
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IServiceDefinitionConfig, IServiceDefinitionState } from './types';
export declare class AdtServiceDefinition implements IAdtSourceObject<IServiceDefinitionConfig, IServiceDefinitionState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    private readonly capCtx;
    private readonly lockCap;
    private readonly versionsCap;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate service definition configuration before creation
     */
    validate(config: Partial<IServiceDefinitionConfig>): Promise<IServiceDefinitionState>;
    /**
     * Create service definition with full operation chain
     */
    create(config: IServiceDefinitionConfig, _options?: IAdtOperationOptions): Promise<IServiceDefinitionState>;
    /**
     * Read service definition
     */
    read(config: Partial<IServiceDefinitionConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IServiceDefinitionState | undefined>;
    /**
     * Read service definition metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IServiceDefinitionConfig>, options?: IReadOptions): Promise<IServiceDefinitionState>;
    /**
     * Read transport request information for the service definition
     */
    readTransport(config: Partial<IServiceDefinitionConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IServiceDefinitionState>;
    /**
     * Update service definition with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IServiceDefinitionConfig>, options?: IAdtOperationOptions): Promise<IServiceDefinitionState>;
    /**
     * Delete service definition
     */
    delete(config: Partial<IServiceDefinitionConfig>): Promise<IServiceDefinitionState>;
    /**
     * Activate service definition
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IServiceDefinitionConfig>): Promise<IServiceDefinitionState>;
    /**
     * Check service definition
     */
    check(config: Partial<IServiceDefinitionConfig>, status?: string): Promise<IServiceDefinitionState>;
    /**
     * Lock service definition for modification
     */
    lock(config: Partial<IServiceDefinitionConfig>): Promise<string>;
    /**
     * Unlock service definition
     */
    unlock(config: Partial<IServiceDefinitionConfig>, lockHandle: string): Promise<IServiceDefinitionState>;
    getVersions(config: Partial<IServiceDefinitionConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtServiceDefinition.d.ts.map