/**
 * AdtFunctionGroup - High-level CRUD operations for Function Group objects
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
 * - Create: validate → create → check → (no update - function groups are containers)
 * - Update: lock → update(metadata) → unlock → check → activate
 * - Delete: check(deletion) → delete
 *
 * Note: Function groups are containers for function modules and don't have source code.
 * Update only changes metadata (description).
 */
import type { IAbapConnection, IAdtNonVersionedObject, IAdtOperationOptions, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { IAdtContentTypes } from '../shared/contentTypes';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IFunctionGroupConfig, IFunctionGroupState } from './types';
export declare class AdtFunctionGroup implements IAdtNonVersionedObject<IFunctionGroupConfig, IFunctionGroupState> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    protected readonly contentTypes?: IAdtContentTypes;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, contentTypes?: IAdtContentTypes, lockRegistry?: LockRegistry);
    /**
     * Validate function group configuration before creation
     */
    validate(config: Partial<IFunctionGroupConfig>): Promise<IFunctionGroupState>;
    /**
     * Create function group with full operation chain
     * Note: Function groups are containers, so no source code update after create
     */
    create(config: IFunctionGroupConfig, options?: IAdtOperationOptions): Promise<IFunctionGroupState>;
    /**
     * Read function group
     */
    read(config: Partial<IFunctionGroupConfig>, _version?: 'active' | 'inactive', options?: IReadOptions): Promise<IFunctionGroupState | undefined>;
    /**
     * Read function group metadata (object characteristics: package, responsible, description, etc.)
     * For function groups, read() already returns metadata since there's no source code.
     */
    readMetadata(config: Partial<IFunctionGroupConfig>, options?: IReadOptions): Promise<IFunctionGroupState>;
    /**
     * Read transport request information for the function group
     */
    readTransport(config: Partial<IFunctionGroupConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IFunctionGroupState>;
    /**
     * Update function group with full operation chain
     * Always starts with lock
     * Note: Function groups only support metadata updates (description)
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IFunctionGroupConfig>, options?: IAdtOperationOptions): Promise<IFunctionGroupState>;
    /**
     * Delete function group
     */
    delete(config: Partial<IFunctionGroupConfig>): Promise<IFunctionGroupState>;
    /**
     * Activate function group
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IFunctionGroupConfig>): Promise<IFunctionGroupState>;
    /**
     * Check function group
     */
    check(config: Partial<IFunctionGroupConfig>, status?: string): Promise<IFunctionGroupState>;
    /**
     * Lock function group for modification
     */
    lock(config: Partial<IFunctionGroupConfig>): Promise<string>;
    /**
     * Unlock function group
     */
    unlock(config: Partial<IFunctionGroupConfig>, lockHandle: string): Promise<IFunctionGroupState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersions(_config: Partial<IFunctionGroupConfig>): Promise<IObjectVersion[]>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtFunctionGroup.d.ts.map