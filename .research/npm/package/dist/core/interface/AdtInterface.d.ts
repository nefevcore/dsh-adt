/**
 * AdtInterface - High-level CRUD operations for Interface objects
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
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IInterfaceConfig, IInterfaceState } from './types';
export declare class AdtInterface implements IAdtSourceObject<IInterfaceConfig, IInterfaceState> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    protected readonly contentTypes?: IAdtContentTypes;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, contentTypes?: IAdtContentTypes, lockRegistry?: LockRegistry);
    /**
     * Validate interface configuration before creation
     */
    validate(config: Partial<IInterfaceConfig>): Promise<IInterfaceState>;
    /**
     * Create interface with full operation chain
     */
    create(config: IInterfaceConfig, options?: IAdtOperationOptions): Promise<IInterfaceState>;
    /**
     * Read interface
     */
    read(config: Partial<IInterfaceConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IInterfaceState | undefined>;
    /**
     * Read interface metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IInterfaceConfig>, options?: IReadOptions): Promise<IInterfaceState>;
    /**
     * Update interface with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IInterfaceConfig>, options?: IAdtOperationOptions): Promise<IInterfaceState>;
    /**
     * Delete interface
     */
    delete(config: Partial<IInterfaceConfig>): Promise<IInterfaceState>;
    /**
     * Activate interface
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IInterfaceConfig>): Promise<IInterfaceState>;
    /**
     * Check interface
     */
    check(config: Partial<IInterfaceConfig>, status?: string): Promise<IInterfaceState>;
    /**
     * Read transport request information for the interface
     */
    readTransport(config: Partial<IInterfaceConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IInterfaceState>;
    /**
     * Lock interface for modification
     */
    lock(config: Partial<IInterfaceConfig>): Promise<string>;
    /**
     * Unlock interface
     */
    unlock(config: Partial<IInterfaceConfig>, lockHandle: string): Promise<IInterfaceState>;
    getVersions(config: Partial<IInterfaceConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtInterface.d.ts.map