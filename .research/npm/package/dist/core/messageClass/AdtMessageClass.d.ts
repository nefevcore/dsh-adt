/**
 * AdtMessageClass — High-level CRUD operations for Message Class (MSAG/N) objects.
 *
 * Implements IAdtObject<IMessageClassConfig, IMessageClassState>.
 *
 * Session management:
 * - stateful: only during lock → update/delete → unlock chains
 * - stateless: mandatory after unlock
 *
 * Unsupported operations (message classes are not activatable):
 * - activate, check, getVersions, getVersionSource → throwUnsupportedOperation
 *
 * transport: config.transportRequest is sent as corrNr on create/update and as
 * <del:transportNumber> on delete (transportable packages); local packages send none.
 */
import type { IAbapConnection, IAdtCrud, IAdtLockable, IAdtOperationOptions, IAdtValidatable, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IMessageClassConfig, IMessageClassState } from './types';
export declare class AdtMessageClass implements IAdtCrud<IMessageClassConfig, IMessageClassState>, IAdtValidatable<IMessageClassConfig, IMessageClassState>, IAdtLockable<IMessageClassConfig, IMessageClassState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Validate name + description via the ADT validation endpoint.
     */
    validate(config: Partial<IMessageClassConfig>): Promise<IMessageClassState>;
    /**
     * Create a new message class (shell with name/description/package).
     * No activation is needed — message classes are not activated.
     */
    create(config: IMessageClassConfig, _options?: IAdtOperationOptions): Promise<IMessageClassState>;
    /**
     * Read message class metadata and messages.
     * Returns undefined on 404 (object does not exist).
     */
    read(config: Partial<IMessageClassConfig>, _version?: 'active' | 'inactive', options?: {
        withLongPolling?: boolean;
    }): Promise<IMessageClassState | undefined>;
    /**
     * Update a message class.
     * Full operation chain: stateful → lock → read current → rebuild XML → PUT → unlock → stateless.
     * On failure: unlock if locked, then stateless.
     */
    update(config: Partial<IMessageClassConfig>, _options?: IAdtOperationOptions): Promise<IMessageClassState>;
    /**
     * Delete a message class.
     * Operation chain: check(deletion) → delete via the stateless ADT deletion
     * service (/deletion/check + /deletion/delete). No lock, no direct DELETE.
     */
    delete(config: Partial<IMessageClassConfig>): Promise<IMessageClassState>;
    /**
     * Read message class metadata.
     * Message classes have no separate metadata endpoint — delegates to read().
     */
    readMetadata(config: Partial<IMessageClassConfig>, options?: {
        withLongPolling?: boolean;
        version?: 'active' | 'inactive';
    }): Promise<IMessageClassState>;
    /**
     * Read transport request information.
     * Transport endpoint is not confirmed for message classes — always throws.
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    readTransport(config: Partial<IMessageClassConfig>): Promise<IMessageClassState>;
    /**
     * Lock message class for modification (low-level — use when managing lock externally).
     */
    lock(config: Partial<IMessageClassConfig>): Promise<string>;
    /**
     * Unlock message class (low-level).
     */
    unlock(config: Partial<IMessageClassConfig>, lockHandle: string): Promise<IMessageClassState>;
    /**
     * Message classes are not activated — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    activate(_config: Partial<IMessageClassConfig>): Promise<IMessageClassState>;
    /**
     * Syntax check is not applicable to message classes — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    check(_config: Partial<IMessageClassConfig>): Promise<IMessageClassState>;
    /**
     * Version history is not supported for message classes — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    getVersions(_config: Partial<IMessageClassConfig>): Promise<IObjectVersion[]>;
    /**
     * Version source retrieval is not supported for message classes — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtMessageClass.d.ts.map