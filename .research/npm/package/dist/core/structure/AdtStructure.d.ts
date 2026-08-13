/**
 * AdtStructure - High-level CRUD operations for Structure objects
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
import type { IStructureConfig, IStructureState } from './types';
export declare class AdtStructure implements IAdtSourceObject<IStructureConfig, IStructureState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate structure configuration before creation
     */
    validate(config: Partial<IStructureConfig>): Promise<IStructureState>;
    /**
     * Create structure metadata only
     * Use update() to upload DDL code after creation
     */
    create(config: IStructureConfig, options?: IAdtOperationOptions): Promise<IStructureState>;
    /**
     * Read structure
     */
    read(config: Partial<IStructureConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IStructureState | undefined>;
    /**
     * Read structure metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IStructureConfig>, options?: IReadOptions): Promise<IStructureState>;
    /**
     * Read transport request information for the structure
     */
    readTransport(config: Partial<IStructureConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IStructureState>;
    /**
     * Update structure with full operation chain
     * Always starts with lock
     * If options.low is true, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IStructureConfig>, options?: IAdtOperationOptions): Promise<IStructureState>;
    /**
     * Delete structure
     */
    delete(config: Partial<IStructureConfig>): Promise<IStructureState>;
    /**
     * Activate structure
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IStructureConfig>): Promise<IStructureState>;
    /**
     * Check structure
     */
    check(config: Partial<IStructureConfig>, status?: string): Promise<IStructureState>;
    /**
     * Lock structure for modification
     */
    lock(config: Partial<IStructureConfig>): Promise<string>;
    /**
     * Unlock structure
     */
    unlock(config: Partial<IStructureConfig>, lockHandle: string): Promise<IStructureState>;
    getVersions(config: Partial<IStructureConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtStructure.d.ts.map