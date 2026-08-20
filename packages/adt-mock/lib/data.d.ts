/**
 * Sample object store for the mock ADT server.
 *
 * Mirrors the shape of real ADT repository objects well enough for protocol
 * testing: class pools with includes, interfaces, programs, packages and a
 * CDS view, plus deterministic ABAP Unit and ATC outcomes.
 */
export interface MockObject {
    uri: string;
    type: string;
    category: string;
    name: string;
    description: string;
    packageName: string;
    source: string;
    changedAt: string;
    changedBy: string;
    masterLanguage: string;
    /** Structured metadata XML (MSAG/DOMA/DTEL/TTYP editors). */
    metadataXml?: string;
    /**
     * Snapshot of the source at its last ACTIVATION (the "active" version).
     * Plain reads return `source` (the current saved state — inactive when it
     * differs); `?version=active` reads return this. Mirrors the real backend:
     * writing does not activate, activating promotes saved → active.
     */
    activeSource?: string;
    /**
     * Open transport request the object currently belongs to (the corrNr of
     * its last write). Locking returns it instead of creating a new task —
     * mirroring the real backend, where an object already in an open request
     * stays there and only fresh objects get an auto-created task.
     */
    corrNr?: string;
    /** Unit test outcome when this object is tested. */
    unit?: {
        total: number;
        passed: number;
        failed: number;
        failedMethod?: string;
        failedMessage?: string;
    };
    /** ATC findings emitted when this object is checked. */
    atcFindings?: Array<{
        check: string;
        checkTitle: string;
        severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
        message: string;
        line?: number;
    }>;
}
export declare const OBJECTS: MockObject[];
/** Deterministic sample runtime dumps (ST22) exposed by the mock. */
export interface MockDump {
    id: string;
    title: string;
    category: string;
    user: string;
    updatedAt: string;
    program: string;
    text: string;
}
export declare const DUMPS: MockDump[];
export declare const PACKAGES: Record<string, {
    description: string;
    parent?: string;
}>;
//# sourceMappingURL=data.d.ts.map