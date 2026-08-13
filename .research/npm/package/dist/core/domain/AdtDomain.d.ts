/**
 * AdtDomain - High-level CRUD operations for Domain objects
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
import type { IAbapConnection, IAdtNonVersionedObject, IAdtOperationOptions, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IDomainConfig, IDomainState } from './types';
export declare class AdtDomain implements IAdtNonVersionedObject<IDomainConfig, IDomainState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    private readonly capCtx;
    private readonly lockCap;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate domain configuration before creation
     */
    validate(config: Partial<IDomainConfig>): Promise<IDomainState>;
    /**
     * Create domain with full operation chain
     */
    create(config: IDomainConfig, options?: IAdtOperationOptions): Promise<IDomainState>;
    /**
     * Read domain
     */
    read(config: Partial<IDomainConfig>, _version?: 'active' | 'inactive', options?: IReadOptions): Promise<IDomainState | undefined>;
    /**
     * Read domain metadata (object characteristics: package, responsible, description, etc.)
     * For domains, read() already returns metadata since there's no source code.
     */
    readMetadata(config: Partial<IDomainConfig>, options?: IReadOptions): Promise<IDomainState>;
    /**
     * Update domain with full operation chain
     * Always starts with lock
     */
    update(config: Partial<IDomainConfig>, options?: IAdtOperationOptions): Promise<IDomainState>;
    /**
     * Delete domain
     */
    delete(config: Partial<IDomainConfig>): Promise<IDomainState>;
    /**
     * Activate domain
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IDomainConfig>): Promise<IDomainState>;
    /**
     * Check domain
     */
    check(config: Partial<IDomainConfig>, status?: string): Promise<IDomainState>;
    /**
     * Read transport request information for the domain
     */
    readTransport(config: Partial<IDomainConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IDomainState>;
    /**
     * Lock domain for modification
     */
    lock(config: Partial<IDomainConfig>): Promise<string>;
    /**
     * Unlock domain
     */
    unlock(config: Partial<IDomainConfig>, lockHandle: string): Promise<IDomainState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersions(_config: Partial<IDomainConfig>): Promise<IObjectVersion[]>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtDomain.d.ts.map