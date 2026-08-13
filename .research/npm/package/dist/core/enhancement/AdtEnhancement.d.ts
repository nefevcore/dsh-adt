/**
 * AdtEnhancement - High-level CRUD operations for Enhancement objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Supports multiple enhancement types:
 * - enhoxh: Enhancement Implementation (ENHO)
 * - enhoxhb: BAdI Implementation
 * - enhoxhh: Source Code Plugin (has source code)
 * - enhsxs: Enhancement Spot (ENHS)
 * - enhsxsb: BAdI Enhancement Spot
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
import type { LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { type IEnhancementConfig, type IEnhancementState } from './types';
export declare class AdtEnhancement implements IAdtSourceObject<IEnhancementConfig, IEnhancementState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockRegistry?;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /** Registry key for a held enhancement lock (e.g. `Enhancement/ZFOO`). */
    private lockKey;
    /**
     * Record a held lock. Enhancement unlock needs the enhancement type, so the
     * unlock thunk captures it alongside the name and handle.
     */
    private trackLock;
    /** Drop a lock from the registry after a clean unlock. */
    private untrackLock;
    /**
     * Validate enhancement configuration before creation
     */
    validate(config: Partial<IEnhancementConfig>): Promise<IEnhancementState>;
    /**
     * Create enhancement with full operation chain
     */
    create(config: IEnhancementConfig, options?: IAdtOperationOptions): Promise<IEnhancementState>;
    /**
     * Read enhancement
     */
    read(config: Partial<IEnhancementConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IEnhancementState | undefined>;
    /**
     * Read enhancement metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IEnhancementConfig>, options?: IReadOptions): Promise<IEnhancementState>;
    /**
     * Read transport request information for the enhancement
     */
    readTransport(config: Partial<IEnhancementConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IEnhancementState>;
    /**
     * Update enhancement with full operation chain
     * Always starts with lock
     * Only available for enhoxhh (Source Code Plugin) type
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IEnhancementConfig>, options?: IAdtOperationOptions): Promise<IEnhancementState>;
    /**
     * Delete enhancement
     */
    delete(config: Partial<IEnhancementConfig>): Promise<IEnhancementState>;
    /**
     * Activate enhancement
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IEnhancementConfig>): Promise<IEnhancementState>;
    /**
     * Check enhancement
     */
    check(config: Partial<IEnhancementConfig>, status?: string): Promise<IEnhancementState>;
    /**
     * Lock enhancement for modification
     */
    lock(config: Partial<IEnhancementConfig>): Promise<string>;
    /**
     * Unlock enhancement
     */
    unlock(config: Partial<IEnhancementConfig>, lockHandle: string): Promise<IEnhancementState>;
    getVersions(config: Partial<IEnhancementConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtEnhancement.d.ts.map