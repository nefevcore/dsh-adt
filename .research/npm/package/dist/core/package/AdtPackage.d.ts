/**
 * AdtPackage - High-level CRUD operations for Package objects
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
 *
 * Operation chains:
 * - Create: validate → create → check
 * - Update: lock → check(inactive) → update → unlock → check
 * - Delete: check(deletion) → delete
 *
 * Note: Packages are containers and don't have source code.
 * Update only changes metadata (description, superPackage, etc.).
 * Packages don't have activate operation (they are not activated).
 */
import type { IAbapConnection, IAdtCheckable, IAdtCrud, IAdtLockable, IAdtOperationOptions, IAdtTransportAware, IAdtValidatable, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IPackageConfig, IPackageState } from './types';
export declare class AdtPackage implements IAdtCrud<IPackageConfig, IPackageState>, IAdtValidatable<IPackageConfig, IPackageState>, IAdtCheckable<IPackageConfig, IPackageState>, IAdtLockable<IPackageConfig, IPackageState>, IAdtTransportAware<IPackageConfig, IPackageState> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate package configuration before creation
     */
    validate(config: Partial<IPackageConfig>): Promise<IPackageState>;
    /**
     * Create package with full operation chain
     * Note: Packages are containers, so no source code update after create
     */
    create(config: IPackageConfig, options?: IAdtOperationOptions): Promise<IPackageState>;
    /**
     * Read package
     */
    read(config: Partial<IPackageConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IPackageState | undefined>;
    /**
     * Read package metadata (object characteristics: package, responsible, description, etc.)
     * For packages, read() already returns metadata since there's no source code.
     */
    readMetadata(config: Partial<IPackageConfig>, options?: IReadOptions): Promise<IPackageState>;
    /**
     * Read transport request information for the package
     */
    readTransport(config: Partial<IPackageConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IPackageState>;
    /**
     * Update package with full operation chain
     * Always starts with lock
     * Note: Packages only support metadata updates (description, superPackage, etc.)
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IPackageConfig>, options?: IAdtOperationOptions): Promise<IPackageState>;
    /**
     * Delete package
     */
    delete(config: Partial<IPackageConfig>): Promise<IPackageState>;
    /**
     * Activate package
     * Note: Packages don't have activate operation - this is a stub
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    activate(_config: Partial<IPackageConfig>): Promise<IPackageState>;
    /**
     * Check package
     */
    check(config: Partial<IPackageConfig>, status?: string): Promise<IPackageState>;
    /**
     * Lock package for modification
     */
    lock(config: Partial<IPackageConfig>): Promise<string>;
    /**
     * Unlock package
     */
    unlock(config: Partial<IPackageConfig>, lockHandle: string): Promise<IPackageState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersions(_config: Partial<IPackageConfig>): Promise<IObjectVersion[]>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtPackage.d.ts.map