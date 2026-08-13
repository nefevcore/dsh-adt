/**
 * AdtTable - High-level CRUD operations for Table objects
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
import type { ITableConfig, ITableState } from './types';
export declare class AdtTable implements IAdtSourceObject<ITableConfig, ITableState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate table configuration before creation
     */
    validate(config: Partial<ITableConfig>): Promise<ITableState>;
    /**
     * Create table with full operation chain
     */
    create(config: ITableConfig, options?: IAdtOperationOptions): Promise<ITableState>;
    /**
     * Read table
     */
    read(config: Partial<ITableConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<ITableState>;
    /**
     * Read table metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<ITableConfig>, options?: IReadOptions): Promise<ITableState>;
    /**
     * Read transport request information for the table
     */
    readTransport(config: Partial<ITableConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<ITableState>;
    /**
     * Update table with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<ITableConfig>, options?: IAdtOperationOptions): Promise<ITableState>;
    /**
     * Delete table
     */
    delete(config: Partial<ITableConfig>): Promise<ITableState>;
    /**
     * Activate table
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<ITableConfig>): Promise<ITableState>;
    /**
     * Check table
     */
    check(config: Partial<ITableConfig>, status?: string): Promise<ITableState>;
    /**
     * Lock table for modification
     */
    lock(config: Partial<ITableConfig>): Promise<string>;
    /**
     * Unlock table
     */
    unlock(config: Partial<ITableConfig>, lockHandle: string): Promise<ITableState>;
    getVersions(config: Partial<ITableConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtTable.d.ts.map