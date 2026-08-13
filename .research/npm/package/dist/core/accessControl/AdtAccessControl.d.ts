/**
 * AdtAccessControl - High-level CRUD operations for Access Control (DCLS) objects
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
import type { IAccessControlConfig, IAccessControlState } from './types';
export declare class AdtAccessControl implements IAdtSourceObject<IAccessControlConfig, IAccessControlState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate access control configuration before creation
     */
    validate(config: Partial<IAccessControlConfig>): Promise<IAccessControlState>;
    /**
     * Create access control with full operation chain
     */
    create(config: IAccessControlConfig, _options?: IAdtOperationOptions): Promise<IAccessControlState>;
    /**
     * Read access control
     */
    read(config: Partial<IAccessControlConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAccessControlState | undefined>;
    /**
     * Read access control metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IAccessControlConfig>, options?: IReadOptions): Promise<IAccessControlState>;
    /**
     * Read transport request information for the access control
     */
    readTransport(config: Partial<IAccessControlConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IAccessControlState>;
    /**
     * Update access control with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IAccessControlConfig>, options?: IAdtOperationOptions): Promise<IAccessControlState>;
    /**
     * Delete access control
     */
    delete(config: Partial<IAccessControlConfig>): Promise<IAccessControlState>;
    /**
     * Activate access control
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IAccessControlConfig>): Promise<IAccessControlState>;
    /**
     * Check access control
     */
    check(config: Partial<IAccessControlConfig>, status?: string): Promise<IAccessControlState>;
    /**
     * Lock access control for modification
     */
    lock(config: Partial<IAccessControlConfig>): Promise<string>;
    /**
     * Unlock access control
     */
    unlock(config: Partial<IAccessControlConfig>, lockHandle: string): Promise<IAccessControlState>;
    getVersions(config: Partial<IAccessControlConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtAccessControl.d.ts.map