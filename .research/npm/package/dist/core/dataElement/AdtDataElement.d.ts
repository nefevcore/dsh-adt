/**
 * AdtDataElement - High-level CRUD operations for Data Element objects
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
import type { IAbapConnection, IAdtNonVersionedObject, IAdtOperationOptions, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IDataElementConfig, IDataElementState } from './types';
export declare class AdtDataElement implements IAdtNonVersionedObject<IDataElementConfig, IDataElementState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate data element configuration before creation
     */
    validate(config: Partial<IDataElementConfig>): Promise<IDataElementState>;
    /**
     * Create data element with full operation chain
     */
    create(config: IDataElementConfig, options?: IAdtOperationOptions): Promise<IDataElementState>;
    /**
     * Read data element
     */
    read(config: Partial<IDataElementConfig>, _version?: 'active' | 'inactive', options?: IReadOptions): Promise<IDataElementState | undefined>;
    /**
     * Read data element metadata (object characteristics: package, responsible, description, etc.)
     * For data elements, read() already returns metadata since there's no source code.
     */
    readMetadata(config: Partial<IDataElementConfig>, options?: IReadOptions): Promise<IDataElementState>;
    /**
     * Update data element with full operation chain
     * Always starts with lock
     * If options.low is true, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IDataElementConfig>, options?: IAdtOperationOptions): Promise<IDataElementState>;
    /**
     * Delete data element
     */
    delete(config: Partial<IDataElementConfig>): Promise<IDataElementState>;
    /**
     * Activate data element
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IDataElementConfig>): Promise<IDataElementState>;
    /**
     * Check data element
     */
    check(config: Partial<IDataElementConfig>, status?: string): Promise<IDataElementState>;
    /**
     * Read transport request information for the data element
     */
    readTransport(config: Partial<IDataElementConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IDataElementState>;
    /**
     * Lock data element for modification
     */
    lock(config: Partial<IDataElementConfig>): Promise<string>;
    /**
     * Unlock data element
     */
    unlock(config: Partial<IDataElementConfig>, lockHandle: string): Promise<IDataElementState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersions(_config: Partial<IDataElementConfig>): Promise<IObjectVersion[]>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtDataElement.d.ts.map