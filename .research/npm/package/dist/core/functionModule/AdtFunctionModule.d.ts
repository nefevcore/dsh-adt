/**
 * AdtFunctionModule - High-level CRUD operations for Function Module objects
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
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IFunctionModuleConfig, IFunctionModuleState } from './types';
export declare class AdtFunctionModule implements IAdtSourceObject<IFunctionModuleConfig, IFunctionModuleState> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    protected readonly contentTypes?: IAdtContentTypes;
    private readonly lockRegistry?;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, contentTypes?: IAdtContentTypes, lockRegistry?: LockRegistry);
    /** Registry key for a held lock (nested: group + module). */
    private lockKey;
    /** Record a held lock; the unlock thunk needs the parent function group. */
    private trackLock;
    /** Drop a lock from the registry after a clean unlock. */
    private untrackLock;
    /**
     * Validate function module configuration before creation
     */
    validate(config: Partial<IFunctionModuleConfig>): Promise<IFunctionModuleState>;
    /**
     * Create function module with full operation chain
     */
    create(config: IFunctionModuleConfig, options?: IAdtOperationOptions): Promise<IFunctionModuleState>;
    /**
     * Read function module
     */
    read(config: Partial<IFunctionModuleConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IFunctionModuleState | undefined>;
    /**
     * Read function module metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IFunctionModuleConfig>, options?: IReadOptions): Promise<IFunctionModuleState>;
    /**
     * Read transport request information for the function module
     */
    readTransport(config: Partial<IFunctionModuleConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IFunctionModuleState>;
    /**
     * Update function module with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IFunctionModuleConfig>, options?: IAdtOperationOptions): Promise<IFunctionModuleState>;
    /**
     * Delete function module
     */
    delete(config: Partial<IFunctionModuleConfig>): Promise<IFunctionModuleState>;
    /**
     * Activate function module
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IFunctionModuleConfig>): Promise<IFunctionModuleState>;
    /**
     * Check function module
     */
    check(config: Partial<IFunctionModuleConfig>, status?: string): Promise<IFunctionModuleState>;
    /**
     * Lock function module for modification
     */
    lock(config: Partial<IFunctionModuleConfig>): Promise<string>;
    /**
     * Unlock function module
     */
    unlock(config: Partial<IFunctionModuleConfig>, lockHandle: string): Promise<IFunctionModuleState>;
    getVersions(config: Partial<IFunctionModuleConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtFunctionModule.d.ts.map