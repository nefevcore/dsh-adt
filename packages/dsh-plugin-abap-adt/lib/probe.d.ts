/** Default per-candidate timeout: unreachable intranet hosts must not stall a listing. */
export declare const DEFAULT_PROBE_TIMEOUT_MS = 2500;
/** Outcome of probing ONE candidate URL. */
export interface UrlProbe {
    url: string;
    /** Host:port answered with HTTP (does not imply ADT works — see adtLikely). */
    reachable: boolean;
    /** HTTP status when reachable. */
    status?: number;
    /** Reachable AND the status suggests a live ADT endpoint (2xx/3xx/401/403). */
    adtLikely: boolean;
    /** Human-readable result: confirmation or the connection-level failure reason. */
    detail: string;
}
/** Options shared by {@link probeUrl} and the batch helpers. */
export interface ProbeOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
}
/**
 * Common ADT URL combinations for a GUI application server, best-guess order:
 * ICM HTTPS port convention, then HTTPS default port (web dispatcher /
 * reverse proxy), then the plain-HTTP ICM convention, then HTTP default.
 */
export declare function candidateAdtUrls(host: string, sysnr: string | undefined): string[];
/**
 * Probe ONE candidate: credential-less GET `<url>/sap/bc/adt`, certificates
 * NOT verified (self-signed intranet is the norm for GUI-managed systems),
 * short timeout. Never rejects — always resolves with a classified result.
 */
export declare function probeUrl(url: string, options?: ProbeOptions): Promise<UrlProbe>;
/** Probe every candidate of a host concurrently (results in candidate order). */
export declare function probeCandidateUrls(host: string, sysnr: string | undefined, options?: ProbeOptions): Promise<UrlProbe[]>;
/**
 * Pick the candidate to USE: the first ADT-likely reachable one (candidate
 * order = preference), else the first merely-reachable one, else undefined.
 */
export declare function pickVerifiedProbe(probes: UrlProbe[]): UrlProbe | undefined;
/** 'https://h:44301 → connection refused; https://h → no response (timeout); …' */
export declare function summarizeProbes(probes: UrlProbe[]): string;
/**
 * Guidance when NO usable candidate was found — the honest answer instead
 * of a silently "successful" import. Causes ordered by practical likelihood.
 */
export declare function unreachableGuidance(router?: string): string;
//# sourceMappingURL=probe.d.ts.map