export interface LockEntry {
    /** Unique id of the entry. */
    id: string;
    /** Destination name the lock was acquired on. */
    destination: string;
    /** ADT object URI, e.g. /sap/bc/adt/oo/classes/zcl_demo. */
    uri: string;
    /** Object name (for human-readable reporting). */
    name?: string;
    /** Lock handle when the backend returned one. */
    handle?: string;
    /** Transport request the lock is assigned to, when reported. */
    transport?: string;
    /** When the lock was acquired (ISO). */
    acquiredAt: string;
    /** Why the handle may be missing (e.g. 'create auto-lock'). */
    note?: string;
}
/** Resolve the ledger file path inside the DSH storages area (never throws). */
export declare function ledgerFilePath(): string;
export declare class LockLedger {
    private entries;
    private readonly file;
    constructor(file?: string);
    private load;
    private persist;
    /** Record a lock we acquired (or an object a create may have auto-locked). */
    register(entry: Omit<LockEntry, 'id' | 'acquiredAt'>): LockEntry;
    /** Drop the entry for a released lock. */
    deregister(destination: string, uri: string): void;
    /** Every recorded lock for a destination. */
    forDestination(destination: string): LockEntry[];
    /** The recorded handle for one object (undefined when unknown). */
    handleFor(destination: string, uri: string): string | undefined;
    /** All entries (for reporting). */
    all(): LockEntry[];
}
//# sourceMappingURL=locks.d.ts.map