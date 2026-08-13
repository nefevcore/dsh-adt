/**
 * AdtFunctionInclude - High-level CRUD operations for Function Include (FUGR/I).
 *
 * Implements IAdtObject with automatic operation chains, error handling,
 * and resource cleanup.
 *
 * Session management:
 * - stateful: only when doing lock / unlock / source upload
 * - stateless: obligatory after unlock
 * - activate uses the same session / cookies (no stateful required)
 *
 * Operation chains:
 * - Create: validate (parent group) → create → (if sourceCode) lock → upload → unlock → activate
 * - Update: lock → check(inactive, sourceCode?) → updateMetadata → (optional sourceUpload) → read polling → unlock → check(inactive) → optional activate + read
 * - Delete: check(deletion) → delete
 */
import type { IAbapConnection, IAdtActivatable, IAdtCheckable, IAdtCrud, IAdtLockable, IAdtOperationOptions, IAdtValidatable, IAdtVersionable, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { LockRegistry } from '../shared/LockRegistry';
import { type IReadOptions } from './read';
import type { IFunctionIncludeConfig, IFunctionIncludeState } from './types';
export declare class AdtFunctionInclude implements IAdtCrud<IFunctionIncludeConfig, IFunctionIncludeState>, IAdtValidatable<IFunctionIncludeConfig, IFunctionIncludeState>, IAdtCheckable<IFunctionIncludeConfig, IFunctionIncludeState>, IAdtActivatable<IFunctionIncludeConfig, IFunctionIncludeState>, IAdtLockable<IFunctionIncludeConfig, IFunctionIncludeState>, IAdtVersionable<IFunctionIncludeConfig> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    protected readonly contentTypes?: IAdtContentTypes;
    private readonly lockRegistry?;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, contentTypes?: IAdtContentTypes, lockRegistry?: LockRegistry);
    /** Registry key for a held lock (nested: group + include). */
    private lockKey;
    /** Record a held lock; the unlock thunk needs the parent function group. */
    private trackLock;
    /** Drop a lock from the registry after a clean unlock. */
    private untrackLock;
    /**
     * Map camelCase config to the snake_case low-level params.
     */
    private buildCreateParams;
    private buildDeleteParams;
    /**
     * Resolve source artifact content type — used both for the source-aware
     * checkrun payload and for the unicode flag of the source upload.
     */
    private sourceArtifactContentType;
    private isUnicode;
    /**
     * Validate by probing parent function group's existence.
     */
    validate(config: Partial<IFunctionIncludeConfig>): Promise<IFunctionIncludeState>;
    /**
     * Create function include (optionally uploading source and activating).
     */
    create(config: IFunctionIncludeConfig, options?: IAdtOperationOptions): Promise<IFunctionIncludeState>;
    /**
     * Read function include SOURCE code.
     *
     * Per the IAdtObject contract, `read()` returns source for objects that have
     * it (metadata is available via `readMetadata()`). This object has source, so
     * `read()` is an alias of `readSource()`. (Historically it returned metadata,
     * which was inconsistent with class/program/function-module `read()`.)
     */
    read(config: Partial<IFunctionIncludeConfig>, version?: 'active' | 'inactive', _options?: IReadOptions): Promise<IFunctionIncludeState | undefined>;
    /**
     * Low-level metadata read (the object's `finclude` XML), with 404 -> undefined.
     * Used by readMetadata() and by the create/update readiness polling, which
     * need metadata semantics and long-polling options (the source endpoint does
     * not take them).
     */
    private readMetadataRaw;
    /**
     * Read function include source code.
     */
    readSource(config: Partial<IFunctionIncludeConfig>, version?: 'active' | 'inactive'): Promise<IFunctionIncludeState | undefined>;
    /**
     * Read metadata — for this object, read() already returns metadata.
     */
    readMetadata(config: Partial<IFunctionIncludeConfig>, options?: IReadOptions & {
        version?: 'active' | 'inactive';
    }): Promise<IFunctionIncludeState>;
    /**
     * Update function include with full operation chain.
     */
    update(config: Partial<IFunctionIncludeConfig>, options?: IAdtOperationOptions): Promise<IFunctionIncludeState>;
    /**
     * Delete function include.
     */
    delete(config: Partial<IFunctionIncludeConfig>): Promise<IFunctionIncludeState>;
    /**
     * Activate function include.
     */
    activate(config: Partial<IFunctionIncludeConfig>): Promise<IFunctionIncludeState>;
    /**
     * Check function include.
     */
    check(config: Partial<IFunctionIncludeConfig>, status?: string): Promise<IFunctionIncludeState>;
    /**
     * Read transport info — not supported for FUGR/I (transport tracked at group level).
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    readTransport(): Promise<IFunctionIncludeState>;
    /**
     * Lock function include for modification.
     */
    lock(config: Partial<IFunctionIncludeConfig>): Promise<string>;
    /**
     * Unlock function include.
     */
    unlock(config: Partial<IFunctionIncludeConfig>, lockHandle: string): Promise<IFunctionIncludeState>;
    getVersions(config: Partial<IFunctionIncludeConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtFunctionInclude.d.ts.map