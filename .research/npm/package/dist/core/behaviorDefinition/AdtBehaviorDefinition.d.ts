/**
 * AdtBehaviorDefinition - High-level CRUD operations for Behavior Definition objects
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
import type { IBehaviorDefinitionConfig, IBehaviorDefinitionState } from './types';
export declare class AdtBehaviorDefinition implements IAdtSourceObject<IBehaviorDefinitionConfig, IBehaviorDefinitionState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate behavior definition configuration before creation
     */
    validate(config: Partial<IBehaviorDefinitionConfig>): Promise<IBehaviorDefinitionState>;
    /**
     * Create behavior definition with full operation chain
     */
    create(config: IBehaviorDefinitionConfig, options?: IAdtOperationOptions): Promise<IBehaviorDefinitionState>;
    /**
     * Read behavior definition
     */
    read(config: Partial<IBehaviorDefinitionConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IBehaviorDefinitionState | undefined>;
    /**
     * Read behavior definition metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IBehaviorDefinitionConfig>, options?: IReadOptions): Promise<IBehaviorDefinitionState>;
    /**
     * Read transport request information for the behavior definition
     */
    readTransport(config: Partial<IBehaviorDefinitionConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IBehaviorDefinitionState>;
    /**
     * Update behavior definition with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IBehaviorDefinitionConfig>, options?: IAdtOperationOptions): Promise<IBehaviorDefinitionState>;
    /**
     * Delete behavior definition
     */
    delete(config: Partial<IBehaviorDefinitionConfig>): Promise<IBehaviorDefinitionState>;
    /**
     * Activate behavior definition
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IBehaviorDefinitionConfig>): Promise<IBehaviorDefinitionState>;
    /**
     * Check behavior definition
     */
    check(config: Partial<IBehaviorDefinitionConfig>, status?: string): Promise<IBehaviorDefinitionState>;
    /**
     * Lock behavior definition for modification
     */
    lock(config: Partial<IBehaviorDefinitionConfig>): Promise<string>;
    /**
     * Unlock behavior definition
     */
    unlock(config: Partial<IBehaviorDefinitionConfig>, lockHandle: string): Promise<IBehaviorDefinitionState>;
    getVersions(config: Partial<IBehaviorDefinitionConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtBehaviorDefinition.d.ts.map