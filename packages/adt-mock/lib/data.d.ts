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
export declare const PACKAGES: Record<string, {
    description: string;
    parent?: string;
}>;
//# sourceMappingURL=data.d.ts.map