/**
 * AdtMessageClassMessage — read-modify-write operations for a single message
 * within a Message Class (MSAG/N).
 *
 * Implements IAdtObject<IMessageClassMessageConfig, IMessageClassMessageState>.
 *
 * Operation chains:
 * - read:   GET class XML → find message by msgno → return state.message
 * - create/update: GET class → merge message → stateful → lockMessage (MH) +
 *           lockClassForMessage (CH) → PUT full class XML (message with
 *           mc:lockhandle=MH, lockHandle=CH) → unlockAllMessages →
 *           unlock class (CH) → stateless
 * - delete: GET class → stateful → lockMessage (MH) + lockClassForMessage (CH)
 *           → PUT class XML with target message as <mc:deletedmessages
 *           mc:lockhandle=MH>, all other messages as <mc:messages> →
 *           unlockAllMessages → unlock class (CH) → stateless.
 *           (SAP does NOT delete omitted messages on PUT — <mc:deletedmessages>
 *           is the correct mechanism. A message-level DELETE /messages/{no}
 *           returns 423 and is NOT used.)
 *
 * Unsupported: activate, check, validate, lock, unlock, getVersions,
 * getVersionSource, readTransport → throwUnsupportedOperation.
 *
 * transport: when config.transportRequest is set (transportable package), it is
 * appended as &corrNr= on the class PUT, like the other CRUD object types.
 */
import type { IAbapConnection, IAdtCrud, IAdtOperationOptions, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IMessageClassMessageConfig, IMessageClassMessageState } from './types';
export declare class AdtMessageClassMessage implements IAdtCrud<IMessageClassMessageConfig, IMessageClassMessageState> {
    private readonly connection;
    private readonly logger?;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger);
    /**
     * Read a single message from the parent class.
     * Returns undefined when the parent class itself is absent (404).
     * Throws OBJECT_NOT_FOUND when the class exists but the message number is absent.
     */
    read(config: Partial<IMessageClassMessageConfig>): Promise<IMessageClassMessageState | undefined>;
    /**
     * Create or upsert a single message in the parent class.
     * Delegates to the update logic.
     */
    create(config: IMessageClassMessageConfig, _options?: IAdtOperationOptions): Promise<IMessageClassMessageState>;
    /**
     * Update (upsert) a single message in the parent class.
     * Full chain: GET class → merge message → stateful → LOCK_MSG + class LOCK →
     * PUT class XML → unlock class → unlockAllMessages → stateless.
     */
    update(config: Partial<IMessageClassMessageConfig>, _options?: IAdtOperationOptions): Promise<IMessageClassMessageState>;
    private _upsertMessage;
    /**
     * Delete a single message from the parent class.
     *
     * SAP does NOT remove messages that are merely omitted from a class PUT — it
     * only upserts what is present.  The correct mechanism is to PUT the class
     * with the target message placed in <mc:deletedmessages> (carrying its own
     * message lock handle), while every other message remains in <mc:messages>.
     *
     * Chain: GET class → stateful → lockMessage (MH) + lockClassForMessage (CH)
     * → PUT class XML with target in <mc:deletedmessages mc:lockhandle=MH>,
     * remaining messages in <mc:messages> → unlockAllMessages →
     * unlock class (CH) → stateless.
     */
    delete(config: Partial<IMessageClassMessageConfig>): Promise<IMessageClassMessageState>;
    /** Delegates to read() — individual messages have no separate metadata endpoint. */
    readMetadata(config: Partial<IMessageClassMessageConfig>): Promise<IMessageClassMessageState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    validate(_config: Partial<IMessageClassMessageConfig>): Promise<IMessageClassMessageState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    activate(_config: Partial<IMessageClassMessageConfig>): Promise<IMessageClassMessageState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    check(_config: Partial<IMessageClassMessageConfig>): Promise<IMessageClassMessageState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    readTransport(_config: Partial<IMessageClassMessageConfig>): Promise<IMessageClassMessageState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    lock(_config: Partial<IMessageClassMessageConfig>): Promise<string>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    unlock(_config: Partial<IMessageClassMessageConfig>, _lockHandle: string): Promise<IMessageClassMessageState>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersions(_config: Partial<IMessageClassMessageConfig>): Promise<IObjectVersion[]>;
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtMessageClassMessage.d.ts.map