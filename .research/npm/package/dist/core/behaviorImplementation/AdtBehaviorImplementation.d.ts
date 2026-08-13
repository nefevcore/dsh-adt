/**
 * AdtBehaviorImplementation - High-level CRUD operations for Behavior Implementation objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Behavior Implementation is a special form of class (CLAS/OC) with:
 * - Empty main class source
 * - Special implementations include (local handler class)
 *
 * Uses composition with AdtClass for most operations, overriding only
 * methods that work with implementations include (update, read).
 *
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 *
 * Operation chains:
 * - Create: validate → create (via AdtClass) → check → lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Update: lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Delete: check(deletion) → delete (via AdtClass)
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IBehaviorImplementationConfig, IBehaviorImplementationState } from './types';
export declare class AdtBehaviorImplementation implements IAdtSourceObject<IBehaviorImplementationConfig, IBehaviorImplementationState> {
    private readonly connection;
    private readonly logger?;
    private readonly class;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, lockRegistry?: LockRegistry);
    /**
     * Validate behavior implementation configuration before creation
     */
    validate(config: Partial<IBehaviorImplementationConfig>): Promise<IBehaviorImplementationState>;
    /**
     * Create behavior implementation with full operation chain
     */
    create(config: IBehaviorImplementationConfig, _options?: IAdtOperationOptions): Promise<IBehaviorImplementationState>;
    /**
     * Read behavior implementation
     */
    read(config: Partial<IBehaviorImplementationConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IBehaviorImplementationState | undefined>;
    /**
     * Read behavior implementation metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IBehaviorImplementationConfig>, options?: IReadOptions): Promise<IBehaviorImplementationState>;
    /**
     * Read transport request information for the behavior implementation
     */
    readTransport(config: Partial<IBehaviorImplementationConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IBehaviorImplementationState>;
    /**
     * Update behavior implementation with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IBehaviorImplementationConfig>, options?: IAdtOperationOptions): Promise<IBehaviorImplementationState>;
    /**
     * Delete behavior implementation
     */
    delete(config: Partial<IBehaviorImplementationConfig>): Promise<IBehaviorImplementationState>;
    /**
     * Activate behavior implementation
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IBehaviorImplementationConfig>): Promise<IBehaviorImplementationState>;
    /**
     * Check behavior implementation
     */
    check(config: Partial<IBehaviorImplementationConfig>, status?: string): Promise<IBehaviorImplementationState>;
    /**
     * Lock behavior implementation for modification
     * Delegates to AdtClass since behavior implementation is a class
     */
    lock(config: Partial<IBehaviorImplementationConfig>): Promise<string>;
    /**
     * Unlock behavior implementation
     * Delegates to AdtClass since behavior implementation is a class
     */
    unlock(config: Partial<IBehaviorImplementationConfig>, lockHandle: string): Promise<IBehaviorImplementationState>;
    getVersions(config: Partial<IBehaviorImplementationConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtBehaviorImplementation.d.ts.map