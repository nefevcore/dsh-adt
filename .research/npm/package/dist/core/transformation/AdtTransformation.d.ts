/**
 * AdtTransformation - High-level CRUD operations for XSLT Transformation objects
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
 * - Create: validate → create → (return state, no auto source update)
 * - Update: lock → check(inactive with source) → update → read(longPolling) → unlock → check → activate(optional)
 * - Delete: check(deletion) → delete
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { ITransformationConfig, ITransformationState } from './types';
export declare class AdtTransformation implements IAdtSourceObject<ITransformationConfig, ITransformationState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate transformation configuration before creation
     */
    validate(config: Partial<ITransformationConfig>): Promise<ITransformationState>;
    /**
     * Create transformation with full operation chain
     */
    create(config: ITransformationConfig, _options?: IAdtOperationOptions): Promise<ITransformationState>;
    /**
     * Read transformation source code
     */
    read(config: Partial<ITransformationConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<ITransformationState | undefined>;
    /**
     * Read transformation metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<ITransformationConfig>, options?: IReadOptions): Promise<ITransformationState>;
    /**
     * Read transport request information for the transformation
     */
    readTransport(config: Partial<ITransformationConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<ITransformationState>;
    /**
     * Update transformation with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<ITransformationConfig>, options?: IAdtOperationOptions): Promise<ITransformationState>;
    /**
     * Delete transformation
     */
    delete(config: Partial<ITransformationConfig>): Promise<ITransformationState>;
    /**
     * Activate transformation
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<ITransformationConfig>): Promise<ITransformationState>;
    /**
     * Check transformation
     */
    check(config: Partial<ITransformationConfig>, status?: string): Promise<ITransformationState>;
    /**
     * Lock transformation for modification
     */
    lock(config: Partial<ITransformationConfig>): Promise<string>;
    /**
     * Unlock transformation
     */
    unlock(config: Partial<ITransformationConfig>, lockHandle: string): Promise<ITransformationState>;
    getVersions(config: Partial<ITransformationConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtTransformation.d.ts.map