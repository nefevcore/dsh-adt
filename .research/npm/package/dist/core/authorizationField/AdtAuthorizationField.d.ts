/**
 * AdtAuthorizationField - High-level CRUD operations for SUSO / AUTH objects
 *
 * Implements IAdtObject with automatic operation chains, error handling,
 * and resource cleanup.
 *
 * Session management:
 * - stateful: only when doing lock / unlock
 * - stateless: obligatory after unlock
 * - activate uses the same session / cookies (no stateful required)
 *
 * Operation chains:
 * - Create: validate (caller) → create
 * - Update: lock → check(inactive, xmlContent?) → update → read(longPolling) → unlock → check(inactive) → optional activate + read
 * - Delete: check(deletion) → delete
 */
import type { IAbapConnection, IAdtActivatable, IAdtCheckable, IAdtCrud, IAdtLockable, IAdtOperationOptions, IAdtValidatable, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import { type IReadOptions } from './read';
import type { IAuthorizationFieldConfig, IAuthorizationFieldState } from './types';
export declare class AdtAuthorizationField implements IAdtCrud<IAuthorizationFieldConfig, IAuthorizationFieldState>, IAdtValidatable<IAuthorizationFieldConfig, IAuthorizationFieldState>, IAdtCheckable<IAuthorizationFieldConfig, IAuthorizationFieldState>, IAdtActivatable<IAuthorizationFieldConfig, IAuthorizationFieldState>, IAdtLockable<IAuthorizationFieldConfig, IAuthorizationFieldState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Map camelCase config to the snake_case low-level params the functions expect.
     * Kept private — callers should always go through the handler.
     */
    private buildCreateParams;
    private buildDeleteParams;
    /**
     * Validate authorization field name against SAP naming rules.
     */
    validate(config: Partial<IAuthorizationFieldConfig>): Promise<IAuthorizationFieldState>;
    /**
     * Create authorization field.
     */
    create(config: IAuthorizationFieldConfig, options?: IAdtOperationOptions): Promise<IAuthorizationFieldState>;
    /**
     * Read authorization field metadata.
     */
    read(config: Partial<IAuthorizationFieldConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAuthorizationFieldState | undefined>;
    /**
     * Read metadata — for metadata-only objects, read() already returns it.
     */
    readMetadata(config: Partial<IAuthorizationFieldConfig>, options?: IReadOptions & {
        version?: 'active' | 'inactive';
    }): Promise<IAuthorizationFieldState>;
    /**
     * Update authorization field with full operation chain.
     */
    update(config: Partial<IAuthorizationFieldConfig>, options?: IAdtOperationOptions): Promise<IAuthorizationFieldState>;
    /**
     * Delete authorization field.
     */
    delete(config: Partial<IAuthorizationFieldConfig>): Promise<IAuthorizationFieldState>;
    /**
     * Activate authorization field.
     */
    activate(config: Partial<IAuthorizationFieldConfig>): Promise<IAuthorizationFieldState>;
    /**
     * Check authorization field.
     */
    check(config: Partial<IAuthorizationFieldConfig>, status?: string): Promise<IAuthorizationFieldState>;
    /**
     * Read transport info — not supported by the APS IAM endpoint yet.
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    readTransport(): Promise<IAuthorizationFieldState>;
    /**
     * Lock authorization field for modification.
     */
    lock(config: Partial<IAuthorizationFieldConfig>): Promise<string>;
    /**
     * Unlock authorization field.
     */
    unlock(config: Partial<IAuthorizationFieldConfig>, lockHandle: string): Promise<IAuthorizationFieldState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersions(_config: Partial<IAuthorizationFieldConfig>): Promise<IObjectVersion[]>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtAuthorizationField.d.ts.map