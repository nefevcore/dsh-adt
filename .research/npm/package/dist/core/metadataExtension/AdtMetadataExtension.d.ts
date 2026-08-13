/**
 * AdtMetadataExtension - High-level CRUD operations for Metadata Extension (DDLX) objects
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
import type { IMetadataExtensionConfig, IMetadataExtensionState } from './types';
export declare class AdtMetadataExtension implements IAdtSourceObject<IMetadataExtensionConfig, IMetadataExtensionState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate metadata extension configuration before creation
     */
    validate(config: Partial<IMetadataExtensionConfig>): Promise<IMetadataExtensionState>;
    /**
     * Create metadata extension with full operation chain
     */
    create(config: IMetadataExtensionConfig, _options?: IAdtOperationOptions): Promise<IMetadataExtensionState>;
    /**
     * Read metadata extension
     */
    read(config: Partial<IMetadataExtensionConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IMetadataExtensionState | undefined>;
    /**
     * Read metadata extension metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IMetadataExtensionConfig>, options?: IReadOptions): Promise<IMetadataExtensionState>;
    /**
     * Read transport request information for the metadata extension
     */
    readTransport(config: Partial<IMetadataExtensionConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IMetadataExtensionState>;
    /**
     * Update metadata extension with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IMetadataExtensionConfig>, options?: IAdtOperationOptions): Promise<IMetadataExtensionState>;
    /**
     * Delete metadata extension
     */
    delete(config: Partial<IMetadataExtensionConfig>): Promise<IMetadataExtensionState>;
    /**
     * Activate metadata extension
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IMetadataExtensionConfig>): Promise<IMetadataExtensionState>;
    /**
     * Check metadata extension
     */
    check(config: Partial<IMetadataExtensionConfig>, status?: string): Promise<IMetadataExtensionState>;
    /**
     * Lock metadata extension for modification
     */
    lock(config: Partial<IMetadataExtensionConfig>): Promise<string>;
    /**
     * Unlock metadata extension
     */
    unlock(config: Partial<IMetadataExtensionConfig>, lockHandle: string): Promise<IMetadataExtensionState>;
    getVersions(config: Partial<IMetadataExtensionConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtMetadataExtension.d.ts.map