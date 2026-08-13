/**
 * AdtTableType - High-level CRUD operations for Table Type objects
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
import type { ITableTypeConfig, ITableTypeState } from './types';
export declare class AdtDdicTableType implements IAdtSourceObject<ITableTypeConfig, ITableTypeState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate table type configuration before creation
     */
    validate(config: Partial<ITableTypeConfig>): Promise<ITableTypeState>;
    /**
     * Create table type with full operation chain
     */
    create(config: ITableTypeConfig, options?: IAdtOperationOptions): Promise<ITableTypeState>;
    /**
     * Read table type metadata (TableType is XML-based entity like Domain/DataElement)
     */
    read(config: Partial<ITableTypeConfig>, _version?: 'active' | 'inactive', options?: IReadOptions): Promise<ITableTypeState>;
    /**
     * Read table type metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<ITableTypeConfig>, options?: IReadOptions): Promise<ITableTypeState>;
    /**
     * Read transport request information for the table type
     */
    readTransport(config: Partial<ITableTypeConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<ITableTypeState>;
    /**
     * Update table type with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<ITableTypeConfig>, options?: IAdtOperationOptions): Promise<ITableTypeState>;
    /**
     * Delete table type
     */
    delete(config: Partial<ITableTypeConfig>): Promise<ITableTypeState>;
    /**
     * Activate table type
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<ITableTypeConfig>): Promise<ITableTypeState>;
    /**
     * Check table type
     */
    check(config: Partial<ITableTypeConfig>, status?: string): Promise<ITableTypeState>;
    /**
     * Lock table type for modification
     */
    lock(config: Partial<ITableTypeConfig>): Promise<string>;
    /**
     * Unlock table type
     */
    unlock(config: Partial<ITableTypeConfig>, lockHandle: string): Promise<ITableTypeState>;
    getVersions(config: Partial<ITableTypeConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtDdicTableType.d.ts.map