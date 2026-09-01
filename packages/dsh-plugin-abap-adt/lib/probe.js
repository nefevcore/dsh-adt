/**
 * Candidate ADT URL probing — turns the port-convention GUESS a SAP GUI
 * import relies on into a verified fact.
 *
 * Why: the GUI landscape only carries the DIAG port (`host:32<nn>`), so the
 * ADT base URL must be inferred (`https://host:443<nn>` etc.). That guess is
 * often wrong — the instance number does not have to match the ICM port, the
 * system may sit behind a web dispatcher on plain 443, a firewall may drop
 * the port, or the GUI entry may reach the host through a saprouter (which
 * HTTP cannot follow). The only way to know is to ASK the host: this module
 * fires credential-less HTTP requests at the common combinations and reports
 * which one actually answered.
 *
 * Interpretation: ANY HTTP response proves host:port reachability. Status
 * 401 is the EXPECTED unauthenticated answer of a live ADT endpoint; 2xx/3xx
 * also count as "ADT likely"; 404 means the port answers HTTP but no ADT
 * service lives there. Connection-level errors (refused/timeout/DNS/TLS)
 * mean the candidate is unusable.
 */
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
/** Unauthenticated GET target — cheap, and 401 is the expected live answer. */
const ADT_PROBE_PATH = '/sap/bc/adt';
/** Default per-candidate timeout: unreachable intranet hosts must not stall a listing. */
export const DEFAULT_PROBE_TIMEOUT_MS = 2500;
/**
 * Common ADT URL combinations for a GUI application server, best-guess order:
 * ICM HTTPS port convention, then HTTPS default port (web dispatcher /
 * reverse proxy), then the plain-HTTP ICM convention, then HTTP default.
 */
export function candidateAdtUrls(host, sysnr) {
    const urls = sysnr
        ? [
            `https://${host}:443${sysnr}`,
            `https://${host}`,
            `http://${host}:80${sysnr}`,
            `http://${host}`,
        ]
        : [`https://${host}`, `http://${host}`];
    return [...new Set(urls)];
}
/** Map a connection error to a short, user-facing reason. */
function failureReason(error) {
    const code = error.code ?? '';
    if (code === 'ECONNREFUSED')
        return 'connection refused';
    if (code === 'ENOTFOUND')
        return 'host not found (DNS)';
    if (code === 'ETIMEDOUT' || /timeout/i.test(error.message))
        return 'no response (timeout)';
    if (code === 'ECONNRESET')
        return 'connection reset';
    if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH')
        return 'host unreachable';
    if (code.startsWith('ERR_SSL') || code.startsWith('ERR_TLS') || code === 'EPROTO') {
        return 'TLS handshake failed (not an HTTPS endpoint?)';
    }
    return error.message || 'request failed';
}
/** Classify an HTTP status into (reachable, adtLikely, detail). */
function classifyStatus(url, status) {
    const adtLikely = (status >= 200 && status < 400) || status === 401 || status === 403;
    let detail;
    if (status === 401)
        detail = 'HTTP 401 — endpoint responded, authentication required (expected for ADT without credentials)';
    else if (status === 403)
        detail = 'HTTP 403 — endpoint responded but access is blocked (SICF service or ICM filter?)';
    else if (status >= 200 && status < 300)
        detail = `HTTP ${status} — endpoint responded without challenge`;
    else if (status >= 300 && status < 400)
        detail = `HTTP ${status} — redirect (endpoint responded)`;
    else if (status === 404)
        detail = `HTTP 404 — port answers HTTP but no ADT service at ${ADT_PROBE_PATH}`;
    else
        detail = `HTTP ${status}`;
    return { url, reachable: true, status, adtLikely, detail };
}
/**
 * Probe ONE candidate: credential-less GET `<url>/sap/bc/adt`, certificates
 * NOT verified (self-signed intranet is the norm for GUI-managed systems),
 * short timeout. Never rejects — always resolves with a classified result.
 */
export function probeUrl(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
    return new Promise((resolve) => {
        let target;
        try {
            target = new URL(ADT_PROBE_PATH, url);
        }
        catch {
            resolve({ url, reachable: false, adtLikely: false, detail: 'invalid URL' });
            return;
        }
        let settled = false;
        const finish = (probe) => {
            if (settled)
                return;
            settled = true;
            resolve(probe);
        };
        const request = (target.protocol === 'http:' ? httpGet : httpsGet)(target, {
            rejectUnauthorized: false,
            timeout: timeoutMs,
            headers: { accept: '*/*', 'user-agent': 'dsh-abap-adt-url-probe' },
        }, (res) => {
            res.resume(); // drain the body; only the status matters
            finish(classifyStatus(url, res.statusCode ?? 0));
            request.destroy();
        });
        request.on('timeout', () => request.destroy(new Error(`timeout after ${timeoutMs}ms`)));
        request.on('error', (error) => {
            finish({ url, reachable: false, adtLikely: false, detail: failureReason(error) });
        });
        if (options.signal) {
            options.signal.addEventListener('abort', () => request.destroy(new Error('aborted')), { once: true });
        }
    });
}
/** Probe every candidate of a host concurrently (results in candidate order). */
export function probeCandidateUrls(host, sysnr, options = {}) {
    return Promise.all(candidateAdtUrls(host, sysnr).map((url) => probeUrl(url, options)));
}
/**
 * Pick the candidate to USE: the first ADT-likely reachable one (candidate
 * order = preference), else the first merely-reachable one, else undefined.
 */
export function pickVerifiedProbe(probes) {
    return (probes.find((p) => p.reachable && p.adtLikely) ?? probes.find((p) => p.reachable));
}
/** 'https://h:44301 → connection refused; https://h → no response (timeout); …' */
export function summarizeProbes(probes) {
    return probes.map((p) => `${p.url} → ${p.detail}`).join('; ');
}
/**
 * Guidance when NO usable candidate was found — the honest answer instead
 * of a silently "successful" import. Causes ordered by practical likelihood.
 */
export function unreachableGuidance(router) {
    const causes = [
        'VPN / network not connected to the system',
        'firewall blocks the ADT HTTP ports',
        router
            ? `SAP GUI reaches the host through saprouter ${router}, which HTTP cannot ride — ask for a web-dispatcher url (the HTTP counterpart of a saprouter) and pass it as the explicit url`
            : 'the system is only reachable via a web dispatcher on another address/port',
    ];
    return `no usable ADT endpoint found (${causes.join('; ')})`;
}
//# sourceMappingURL=probe.js.map