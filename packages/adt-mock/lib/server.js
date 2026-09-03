/**
 * Mock ADT server — implements the subset of the `/sap/bc/adt` REST protocol
 * needed to exercise the protocol client end-to-end without a real ABAP
 * system: discovery (AtomPub), search, source read/write on `/source/main`,
 * `_action=LOCK/UNLOCK` lock protocol, activation with in-body messages,
 * check runs, async ABAP Unit + ATC runs with JUnit / checkstyle results,
 * transport requests and object creation via type-specific collections.
 *
 * Behaviors mirror the real protocol (verified against open-source clients):
 * Basic auth, session cookies, CSRF tokens on state-changing requests, and
 * the correct `application/vnd.sap.*` media types in responses.
 *
 * Routing is a declarative table (ROUTES): `method` guards and CSRF
 * enforcement for state-changing routes are declared per route instead of
 * hand-written per branch, so a new route cannot silently miss them. A path
 * match under the wrong method falls through to the trailing 404 (the
 * historical behavior); the single modeled 405 is transport release.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ADT_BASE } from '@nefevcore/abap-adt-protocol';
import { DUMPS, OBJECTS } from './data.js';
const NS_ADT = 'http://www.sap.com/adt/core';
const NS_ASX = 'http://www.sap.com/abapxml';
const NS_EXC = 'http://www.sap.com/adt/xml/exception';
const NS_CHKL = 'http://www.sap.com/adt/checkresult';
const NS_AUNIT = 'http://www.sap.com/adt/api/aunit';
const NS_AUNIT_LEGACY = 'http://www.sap.com/adt/aunit';
const NS_ATC = 'http://www.sap.com/adt/atc';
function xmlEscape(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function adtXml(body) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
function errorXml(text, type = 'E') {
    return adtXml(`<exc:exception xmlns:exc="${NS_EXC}" exc:type="${type}"><exc:message>${xmlEscape(text)}</exc:message><exc:localizedMessage>${xmlEscape(text)}</exc:localizedMessage></exc:exception>`);
}
function sourceXml(obj) {
    return adtXml(`<adt:object xmlns:adt="${NS_ADT}" uri="${obj.uri}" type="${obj.type}" name="${obj.name}" description="${xmlEscape(obj.description)}" changedAt="${obj.changedAt}" changedBy="${obj.changedBy}" masterLanguage="${obj.masterLanguage}">
  <adt:code>${xmlEscape(obj.source)}</adt:code>
</adt:object>`);
}
function objectRefXml(obj, state) {
    const lock = state?.locked.get(obj.uri);
    const lockedBy = lock?.user ? ` adtcore:lockedBy="${lock.user}"` : '';
    const corrNr = obj.corrNr ? ` adtcore:corrNr="${obj.corrNr}"` : '';
    return `<adtcore:objectReference adtcore:uri="${obj.uri}" adtcore:type="${obj.type}" adtcore:name="${obj.name}" adtcore:description="${xmlEscape(obj.description)}" adtcore:packageName="${obj.packageName}"${corrNr}${lockedBy}/>`;
}
/** Sample where-used references keyed by object name (uppercased). */
const WHERE_USED = {
    ZCL_DEMO: [
        { name: 'ZPROG_DEMO', type: 'PROG/P', uri: '/sap/bc/adt/programs/programs/zprog_demo', packageName: 'ZPACK_DEMO', responsible: 'DEMO', usageInformation: 'method call' },
        { name: 'ZCL_FLAKY', type: 'CLAS/OC', uri: '/sap/bc/adt/oo/classes/zcl_flaky', packageName: 'ZPACK_DEMO', responsible: 'DEMO', usageInformation: 'instantiation' },
    ],
    ZIF_DEMO: [
        { name: 'ZCL_DEMO', type: 'CLAS/OC', uri: '/sap/bc/adt/oo/classes/zcl_demo', packageName: 'ZPACK_DEMO', responsible: 'DEMO', usageInformation: 'implements' },
    ],
};
function dataPreviewXml(entity, query = '', rows = 2) {
    const queryEl = query ? `\n  <dataPreview:query>${xmlEscape(query)}</dataPreview:query>` : '';
    const count = Math.max(1, Math.min(rows, 5000));
    const mandt = Array.from({ length: count }, () => '<dataPreview:data>100</dataPreview:data>').join('');
    const ids = Array.from({ length: count }, (_, i) => `<dataPreview:data>${i + 1}</dataPreview:data>`).join('');
    const texts = Array.from({ length: count }, (_, i) => `<dataPreview:data>Row ${i + 1}</dataPreview:data>`).join('');
    return `<dataPreview:dataPreview xmlns:dataPreview="http://www.sap.com/adt/datapreview" entity="${xmlEscape(entity)}">
  <dataPreview:totalRows>1234</dataPreview:totalRows>
  <dataPreview:queryExecutionTime>1.5</dataPreview:queryExecutionTime>
  <dataPreview:metadata name="MANDT" type="CLNT" description="Client" length="3"/>
  <dataPreview:metadata name="ID" type="INT4" description="Row id" length="10"/>
  <dataPreview:metadata name="TEXT" type="CHAR" description="Row text" length="20"/>
  <dataPreview:columns>
    ${mandt}
  </dataPreview:columns>
  <dataPreview:columns>
    ${ids}
  </dataPreview:columns>
  <dataPreview:columns>
    ${texts}
  </dataPreview:columns>${queryEl}
</dataPreview:dataPreview>`;
}
/** Atom feed of an object's version history. */
function versionsFeedXml(obj) {
    const stamp = new Date().toISOString();
    const transport = obj.corrNr ?? 'S4HK900001';
    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Versions of ${obj.name}</title>
  <entry>
    <id>${obj.uri}/source/main/versions/00001</id>
    <title>${xmlEscape(obj.description)}</title>
    <updated>${stamp}</updated>
    <author><name>${obj.changedBy}</name></author>
    <content src="${obj.uri}/source/main?version=00001"/>
    <link rel="http://www.sap.com/adt/relations/transport/request" href="/sap/bc/adt/cts/transportrequests/${transport}" name="${transport}" title="Request of ${obj.name}"/>
  </entry>
  <entry>
    <id>${obj.uri}/source/main/versions/00000</id>
    <title>Initial version</title>
    <updated>2026-01-01T00:00:00.000Z</updated>
    <author><name>DEMO</name></author>
    <content src="${obj.uri}/source/main?version=00000"/>
  </entry>
</feed>`;
}
function lockResultXml(handle, corrnr) {
    return adtXml(`<asx:abap xmlns:asx="${NS_ASX}" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE>${handle}</LOCK_HANDLE>
      <CORRNR>${corrnr}</CORRNR>
    </DATA>
  </asx:values>
</asx:abap>`);
}
/** Initial variable view of a caught debuggee (deterministic). */
function mockDebugVariables() {
    return new Map([
        ['LV_COUNT', { value: '41', type: 'I', readOnly: false }],
        ['LV_NAME', { value: 'MOCK', type: 'C', readOnly: false }],
        ['LT_ROWS', { value: '<3 rows>', type: 'hTABLE', readOnly: false }],
        ['LV_LOCKED', { value: 'untouchable', type: 'C', readOnly: true }],
    ]);
}
function freshDebuggerState() {
    return { listeners: new Map(), breakpoints: new Map(), bpCounter: 0, pendingHit: false };
}
/** Deterministic stored ATC runs exposed by the results collection. */
const ATC_SAMPLE_RUNS = [
    {
        displayId: '10000000000000000000000000000001',
        createdBy: 'DEMO',
        createdAt: '2026-08-13T10:00:00.000Z',
        scope: ['ZCL_FLAKY', 'ZPROG_DEMO'],
    },
    {
        displayId: '10000000000000000000000000000002',
        createdBy: 'DEMO',
        createdAt: '2026-08-12T09:30:00.000Z',
        scope: ['ZCL_DEMO'],
    },
];
/**
 * Deep-copy a seed object so per-server mutations can never leak into the
 * module-level OBJECTS constant — a bare `{ ...o }` still shared the nested
 * `unit` / `atcFindings` objects between servers.
 */
function seedObject(o) {
    return {
        ...o,
        unit: o.unit ? { ...o.unit } : undefined,
        atcFindings: o.atcFindings ? o.atcFindings.map((f) => ({ ...f })) : undefined,
    };
}
export function createMockAdtServer(options = {}) {
    const state = {
        objects: OBJECTS.map(seedObject),
        locked: new Map(),
        csrfToken: randomUUID(),
        sessions: new Set(),
        unitRuns: new Map(),
        atcRunIds: new Set(),
        debugger: freshDebuggerState(),
    };
    const systemId = options.systemId ?? 'MOCK';
    const release = options.release ?? '757';
    const server = createServer(async (req, res) => {
        try {
            await handle(req, res, state, {
                systemId,
                release,
                username: options.username,
                password: options.password,
                legacyUnitOnly: options.legacyUnitOnly ?? false,
                cors: options.cors ?? true,
            });
        }
        catch (error) {
            res.statusCode = error instanceof MockHttpError ? error.status : 500;
            res.setHeader('Content-Type', 'application/xml');
            res.end(errorXml(`${error instanceof MockHttpError ? '' : 'Internal mock error: '}${error.message}`));
        }
    });
    return {
        server,
        state,
        async listen(port = options.port ?? 8123) {
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(port, options.host ?? '127.0.0.1', () => resolve());
            });
            const address = server.address();
            return typeof address === 'object' && address ? address.port : port;
        },
        close() {
            // Destroy keep-alive sockets too (audit P3): a bare close() waits for
            // open connections and swallows the close error.
            return new Promise((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
                server.closeAllConnections();
            });
        },
        /** Access the in-memory object store (tests). */
        get objects() {
            return state.objects;
        },
    };
}
/** Cap on request bodies (audit P3: unbounded reads could balloon memory). */
const MAX_BODY_BYTES = 1_024 * 1_024;
async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            throw new MockHttpError(413, `request body exceeds ${MAX_BODY_BYTES} bytes`);
        }
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}
/** Thrown by handlers to answer with a specific HTTP status. */
class MockHttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
function parseBasicAuth(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Basic '))
        return undefined;
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx < 0)
        return undefined;
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
}
function setSession(req, res, state) {
    const cookie = req.headers.cookie ?? '';
    if (cookie.includes('SAP_SESSIONID_MOCK'))
        return;
    const id = randomUUID().replace(/-/g, '').toUpperCase();
    state.sessions.add(id);
    res.setHeader('Set-Cookie', `SAP_SESSIONID_MOCK_000=${id}; Path=/; HttpOnly`);
}
function checkCsrf(req, res, state) {
    const header = req.headers['x-csrf-token'];
    if (!header) {
        res.statusCode = 403;
        res.setHeader('X-CSRF-Token', 'Required');
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml('CSRF token required — fetch it with X-CSRF-Token: fetch first'));
        return false;
    }
    if (header !== state.csrfToken) {
        res.statusCode = 403;
        res.setHeader('X-CSRF-Token', 'Required');
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml('CSRF token invalid'));
        return false;
    }
    return true;
}
function findObject(state, uri) {
    const candidates = [uri, uri.startsWith(ADT_BASE) ? uri : `${ADT_BASE}${uri}`];
    return state.objects.find((o) => candidates.includes(o.uri));
}
function findObjectByName(state, name) {
    const upper = name.toUpperCase();
    return state.objects.find((o) => o.name.toUpperCase() === upper);
}
async function handle(req, res, state, opts) {
    if (opts.cors !== false) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-CSRF-Token, sap-adt-connection-id, x-sap-adt-sessiontype');
    }
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }
    if (opts.username !== undefined || opts.password !== undefined) {
        const creds = parseBasicAuth(req);
        if (!creds || creds.username !== (opts.username ?? '') || creds.password !== (opts.password ?? '')) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="mock-adt"');
            res.setHeader('Content-Type', 'application/xml');
            res.end(errorXml('Unauthorized'));
            return;
        }
    }
    setSession(req, res, state);
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = url.pathname;
    if (path.startsWith(ADT_BASE))
        path = path.slice(ADT_BASE.length) || '/';
    if (req.headers['x-csrf-token'] === 'fetch') {
        res.setHeader('X-CSRF-Token', state.csrfToken);
    }
    const ctx = { req, res, state, opts, url, path };
    for (const route of ROUTES) {
        if (!route.match(ctx))
            continue;
        if (route.method !== '*' && route.method !== req.method) {
            if (route.wrongMethodStatus !== undefined) {
                res.statusCode = route.wrongMethodStatus;
                res.setHeader('Allow', 'POST');
                res.setHeader('Content-Type', 'application/xml');
                res.end(errorXml(`${route.label} requires POST (got ${req.method})`));
                return;
            }
            continue;
        }
        if (route.csrf && !checkCsrf(req, res, state))
            return;
        await route.handler(ctx);
        return;
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/xml');
    res.end(errorXml(`Mock ADT: no handler for ${req.method} ${path}`));
}
// --- Route handlers (one per table entry) ------------------------------------
// ---- Discovery (AtomPub service doc) ----
function hDiscovery({ res, opts }) {
    res.setHeader('Content-Type', 'application/atomsvc+xml');
    const collections = [
        ['/sap/bc/adt/repository/informationsystem', 'application/xml', 'Repository Information System'],
        ['/sap/bc/adt/repository/activation', 'application/vnd.sap.adt.activation+xml', 'Object Activation'],
        ['/sap/bc/adt/abapunit/runs', 'application/vnd.sap.adt.api.abapunit.run.v1+xml', 'ABAP Unit'],
        ['/sap/bc/adt/atc/runs', 'application/vnd.sap.atc.run.parameters.v1+xml', 'ABAP Test Cockpit'],
        ['/sap/bc/adt/cts/transportrequests', 'application/vnd.sap.adt.transportorganizertree.v1+xml', 'Transport Requests'],
        ['/sap/bc/adt/packages', 'application/vnd.sap.adt.packages.v2+xml', 'Packages'],
        ['/sap/bc/adt/oo/classes', 'application/vnd.sap.adt.oo.classes.v4+xml', 'Classes'],
        ['/sap/bc/adt/oo/interfaces', 'application/vnd.sap.adt.oo.interfaces.v5+xml', 'Interfaces'],
        ['/sap/bc/adt/programs/programs', 'application/vnd.sap.adt.programs.programs.v2+xml', 'Programs'],
        ['/sap/bc/adt/ddls/sources', 'application/vnd.sap.adt.ddlSource.v2+xml', 'CDS Data Definitions'],
        ['/sap/bc/adt/runtime/dumps', 'application/atom+xml;type=feed', 'Runtime Dumps'],
        ['/sap/bc/adt/programs/programrun', 'text/plain', 'Program Execution'],
        ['/sap/bc/adt/oo/classrun', 'text/plain', 'Class Execution'],
        ['/sap/bc/adt/$batch', 'multipart/mixed', 'Batch Processing'],
        ['/sap/bc/adt/core/system/time', 'application/xml', 'System Time'],
    ]
        .map(([href, accept, title]) => `<app:collection href="${href}"><atom:title>${title}</atom:title><app:accept>${accept}</app:accept></app:collection>`)
        .join('\n    ');
    res.end(adtXml(`<app:service xmlns:app="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom">
  <app:workspace>
    <atom:title>${opts.systemId}</atom:title>
    ${collections}
  </app:workspace>
  <feature id="systemId">${opts.systemId}</feature>
  <feature id="release">${opts.release}</feature>
  <feature id="SAP_SYSTEM_NAME">${opts.systemId}</feature>
</app:service>`));
}
// ---- Search ----
function hSearch({ res, state, url }) {
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const operation = url.searchParams.get('operation') ?? 'quickSearch';
    // NaN/0/negative guards (audit P3): a malformed maxResults used to make
    // slice(0, NaN) return an EMPTY hit list.
    const requestedMax = Number(url.searchParams.get('maxResults') ?? 25);
    const maxResults = Number.isFinite(requestedMax) && requestedMax > 0 ? Math.floor(requestedMax) : 25;
    res.setHeader('Content-Type', 'application/xml');
    // Wildcard-aware matching: `Z*` / `*DEMO*` behave like the real ADT search.
    const matcher = wildcardMatcher(query);
    const packageFilter = url.searchParams.get('packageName')?.toUpperCase();
    const inPackage = (o) => !packageFilter || o.packageName === packageFilter;
    const objectHits = state.objects
        .filter((o) => inPackage(o) && (matcher(o.name) || matcher(o.description)))
        .slice(0, maxResults);
    const sourceHits = (operation === 'quickSearchSource' || operation === 'quickSearch') && !packageFilter
        ? state.objects.filter((o) => o.source.toLowerCase().includes(query)).slice(0, maxResults)
        : [];
    const objectXml = objectHits.map((o) => objectRefXml(o, state)).join('\n  ');
    const sourceXmlHits = sourceHits
        .map((o) => {
        const idx = o.source.toLowerCase().indexOf(query);
        const from = Math.max(0, idx - 40);
        const excerpt = o.source.slice(from, idx + query.length + 60).replace(/\n/g, ' ');
        return `<adtcore:sourceReference adtcore:uri="${o.uri}" adtcore:type="${o.type}" adtcore:name="${o.name}"><adtcore:excerpt>${xmlEscape(excerpt)}</adtcore:excerpt></adtcore:sourceReference>`;
    })
        .join('\n  ');
    res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}">
  ${objectXml}
  ${sourceXmlHits}
</adtcore:objectReferences>`));
}
// ---- Where-used (usage references) ----
function hWhereUsed({ res, state, url }) {
    const uri = url.searchParams.get('uri') ?? '';
    const obj = findObject(state, uri);
    const refs = obj ? (WHERE_USED[obj.name.toUpperCase()] ?? []) : [];
    res.setHeader('Content-Type', 'application/xml');
    res.end(adtXml(`<usagereferences:usageReferenceResult xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences">
  <usagereferences:totalReferences>${refs.length}</usagereferences:totalReferences>
  <usagereferences:references>
    ${refs
        .map((r) => `<usagereferences:reference name="${r.name}" type="${r.type}" uri="${r.uri}" packageName="${r.packageName}" responsible="${r.responsible}" usageInformation="${r.usageInformation}"/>`)
        .join('\n    ')}
  </usagereferences:references>
</usagereferences:usageReferenceResult>`));
}
// ---- Data preview (ddic / cds / freestyle SQL) ----
function hDataPreview({ res, url, path }) {
    const dpDdic = DATA_PREVIEW_DDIC_RE.exec(path);
    const dpCds = DATA_PREVIEW_CDS_RE.exec(path);
    const name = (dpDdic?.[1] ?? dpCds?.[1] ?? '').toUpperCase();
    const rowNumber = Number(url.searchParams.get('rowNumber') ?? 2) || 2;
    res.setHeader('Content-Type', 'application/vnd.sap.adt.datapreview.table.v1+xml');
    res.end(adtXml(dataPreviewXml(name, '', rowNumber)));
}
function hDataPreviewFreestyle({ res, url }) {
    const sql = url.searchParams.get('sqlQuery') ?? url.searchParams.get('sql') ?? 'SELECT';
    const rowNumber = Number(url.searchParams.get('rowNumber') ?? 2) || 2;
    res.setHeader('Content-Type', 'application/vnd.sap.adt.datapreview.table.v1+xml');
    res.end(adtXml(dataPreviewXml('QUERY', sql, rowNumber)));
}
// ---- Runtime dumps (ST22 short-dump analysis) ----
function hDumpsList({ res, url }) {
    let dumps = DUMPS;
    const query = url.searchParams.get('$query') ?? '';
    const userMatch = /equals\(\s*user\s*,\s*([^)]+?)\s*\)/.exec(query);
    if (userMatch) {
        // Quoted values (`user, 'DEMO'`) are legal $query syntax — strip the
        // quotes instead of comparing against the quoted literal (audit P3).
        const user = userMatch[1].replace(/^['"]|['"]$/g, '');
        dumps = dumps.filter((d) => d.user.toUpperCase() === user.toUpperCase());
    }
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from)
        dumps = dumps.filter((d) => d.id.slice(0, from.length) >= from);
    if (to)
        dumps = dumps.filter((d) => d.id.slice(0, to.length) <= to);
    const top = Number(url.searchParams.get('$top') ?? 0);
    const skip = Number(url.searchParams.get('$skip') ?? 0);
    if (skip > 0)
        dumps = dumps.slice(skip);
    if (top > 0)
        dumps = dumps.slice(0, top);
    res.setHeader('Content-Type', 'application/atom+xml;type=feed');
    const entries = dumps
        .map((d) => `  <entry>
    <id>${d.id}</id>
    <title>${d.title}</title>
    <category term="${d.category}"/>
    <updated>${d.updatedAt}</updated>
    <author><name>${d.user}</name></author>
    <link href="/sap/bc/adt/runtime/dump/${d.id}" rel="self"/>
  </entry>`)
        .join('\n');
    res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <title>Runtime Dumps</title>\n${entries}\n</feed>`);
}
function hDumpDetail({ res, path }) {
    const dumpMatch = DUMP_RE.exec(path);
    const dump = dumpMatch ? DUMPS.find((d) => d.id === decodeURIComponent(dumpMatch[1])) : undefined;
    if (!dump || !dumpMatch) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Runtime dump ${dumpMatch?.[1]} does not exist`));
        return;
    }
    if (dumpMatch[2] === 'summary') {
        res.setHeader('Content-Type', 'text/html');
        res.end(`<html><body><h1>${dump.title}</h1><p>${xmlEscape(dump.text)}</p></body></html>`);
        return;
    }
    if (dumpMatch[2] === 'formatted') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(`Runtime Errors: ${dump.title}\nDate: ${dump.updatedAt}\nProgram: ${dump.program}\n\n${dump.text}`);
        return;
    }
    res.setHeader('Content-Type', 'application/vnd.sap.adt.runtime.dump.v1+xml');
    res.end(adtXml(`<dump:dump xmlns:dump="http://www.sap.com/adt/runtime/dumps" type="${dump.title}" id="${dump.id}">
  <dump:category>${dump.category}</dump:category>
  <dump:happenedAt>${dump.updatedAt}</dump:happenedAt>
  <dump:program>${dump.program}</dump:program>
  <dump:user>${dump.user}</dump:user>
  <dump:errorAnalysis>
    <dump:shortText>${xmlEscape(dump.text)}</dump:shortText>
    <dump:errorType>${dump.title}</dump:errorType>
  </dump:errorAnalysis>
</dump:dump>`));
}
// ---- Program / class execution ----
function hProgramRun({ res, state, path }) {
    const programRun = PROGRAM_RUN_RE.exec(path);
    const name = decodeURIComponent(programRun[1]).toUpperCase();
    const obj = findObjectByName(state, name);
    if (!obj || obj.category !== 'PROG') {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Program ${name} does not exist`));
        return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`${name} executed (mock run)\nHello, World!\nOutput lines: 2`);
}
function hClassRun({ res, state, path }) {
    const classRun = CLASS_RUN_RE.exec(path);
    const name = decodeURIComponent(classRun[1]).toUpperCase();
    const obj = findObjectByName(state, name);
    if (!obj || obj.category !== 'CLAS') {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Class ${name} does not exist`));
        return;
    }
    if (!/if_oo_adt_classrun/.test(obj.source)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Class ${name} is not runnable (does not implement if_oo_adt_classrun)`));
        return;
    }
    // Echo the out->write( '…' ) lines of the mock source as console output.
    const writes = [...obj.source.matchAll(/out->write\(\s*'([^']*)'/g)].map((m) => m[1]);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(writes.join('\n'));
}
// ---- Protocol-level $batch (multipart embedded HTTP requests) ----
async function hBatch({ res, req, state, opts }) {
    const body = await readBody(req);
    const boundaryMatch = /boundary=([^;\s]+)/.exec(req.headers['content-type'] ?? '');
    const boundary = boundaryMatch?.[1] ?? 'batch';
    const innerResponses = [];
    const rawParts = body
        .split(`--${boundary}`)
        .map((p) => p.replace(/^\r?\n/, '').replace(/\r?\n$/, ''))
        .filter((p) => p.length > 0 && !p.startsWith('--'));
    for (const part of rawParts) {
        // Embedded request: METHOD path HTTP/1.1 after the MIME headers.
        const requestMatch = /(GET|POST|PUT|DELETE)\s+(\S+)\s+HTTP\/1\.[01]/.exec(part);
        if (!requestMatch) {
            innerResponses.push('Content-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\nHTTP/1.1 400 Bad Request\r\nContent-Type: application/xml\r\n\r\n<error>unparseable batch part</error>');
            continue;
        }
        const method = requestMatch[1];
        const innerPath = requestMatch[2];
        // part = MIME headers ␍␍ embedded request (request line + headers ␍␍ body)
        const sections = part.split(/\r?\n\r?\n/);
        const embedded = sections.slice(1).join('\r\n\r\n');
        const embeddedSections = embedded.split(/\r?\n\r?\n/);
        const innerBody = embeddedSections.length > 1 ? embeddedSections.slice(1).join('\r\n\r\n').replace(/\r?\n$/, '') : undefined;
        const innerAccept = /Accept:([^\r\n]+)/i.exec(part)?.[1]?.trim();
        const stub = await dispatchInner(req, state, opts, method, innerPath, innerBody, innerAccept);
        const headerLines = Object.entries(stub.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n');
        innerResponses.push(`Content-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\nHTTP/1.1 ${stub.statusCode} ${stub.statusText}\r\n${headerLines}\r\n\r\n${stub.body}`);
    }
    const responseBoundary = `response_${randomUUID()}`;
    res.setHeader('Content-Type', `multipart/mixed; boundary=${responseBoundary}`);
    res.end(innerResponses.map((r) => `--${responseBoundary}\r\n${r}`).join('\r\n') + `\r\n--${responseBoundary}--\r\n`);
}
// ---- Structured metadata editors (MSAG / DOMA / DTEL / TTYP) ----
function structuredObjectFor(ctx) {
    const obj = findObject(ctx.state, ctx.path);
    if (!obj)
        return undefined;
    const kind = structuredKindFor(obj, ctx.req.headers.accept ?? '', ctx.req.method);
    return kind ? { obj, kind } : undefined;
}
function hStructuredGet(ctx) {
    const found = structuredObjectFor(ctx);
    if (!found)
        return; // unreachable: match verified a structured negotiation
    ctx.res.setHeader('Content-Type', STRUCTURED_MEDIA[found.kind].split(',')[0].trim());
    ctx.res.end(found.obj.metadataXml ?? defaultMetadataXml(found.obj));
}
async function hStructuredPut(ctx) {
    const found = structuredObjectFor(ctx);
    if (!found)
        return; // unreachable: match verified
    const { res, req, state, url } = ctx;
    const { obj: structuredObj } = found;
    const lockHandle = url.searchParams.get('lockHandle');
    const lock = state.locked.get(structuredObj.uri);
    if (!lockHandle || !lock || lock.handle !== lockHandle) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Object ${structuredObj.name} is not locked (lock first with _action=LOCK)`));
        return;
    }
    const patchBody = await readBody(req);
    structuredObj.metadataXml = patchBody;
    structuredObj.changedAt = new Date().toISOString();
    const corrNr = url.searchParams.get('corrNr');
    if (corrNr)
        structuredObj.corrNr = corrNr.toUpperCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}"/>`));
}
// ---- Debugger (standard ADT REST debugger state machine) ---------------------
const NS_DBG = 'http://www.sap.com/adt/debugger';
const DEBUGGER_BREAKPOINT_URI_RE = /adtcore:uri="([^"#]+)(?:#start=(\d+))?"/;
const DEBUGGER_VARIABLE_REQUEST_RE = /<ID>([^<]+)<\/ID>/g;
/** ABAP-XML document wrapper (`asx:abap … asx:values … DATA …`). */
function abapXml(dataInner) {
    return adtXml(`<asx:abap xmlns:asx="${NS_ASX}" version="1.0"><asx:values><DATA>${dataInner}</DATA></asx:values></asx:abap>`);
}
/** The debuggee document a listener gets when a breakpoint is hit. */
function debuggeeXml(session, terminalId, ideId, systemId) {
    return abapXml(`<STPDA_DEBUGGEE>` +
        `<CLIENT>000</CLIENT>` +
        `<DEBUGGEE_ID>${session.debuggeeId}</DEBUGGEE_ID>` +
        `<TERMINAL_ID>${terminalId}</TERMINAL_ID>` +
        `<IDE_ID>${ideId}</IDE_ID>` +
        `<DEBUGGEE_USER>${session.user}</DEBUGGEE_USER>` +
        `<PRG_CURR>${session.program}</PRG_CURR>` +
        `<INCL_CURR>${session.include}</INCL_CURR>` +
        `<LINE_CURR>${session.line}</LINE_CURR>` +
        `<RFCDEST></RFCDEST><APPLSERVER>mock_server</APPLSERVER><SYSID>${systemId}</SYSID>` +
        `<DBGEE_KIND>DIALOG</DBGEE_KIND><IS_ATTACH_IMPOSSIBLE></IS_ATTACH_IMPOSSIBLE>` +
        `<IS_SAME_SERVER>X</IS_SAME_SERVER>` +
        `</STPDA_DEBUGGEE>`);
}
/** One `dbg:step` document mirroring the current session state. */
function debugStepXml(session, step) {
    const running = !session || session.running;
    return adtXml(`<dbg:step xmlns:dbg="${NS_DBG}" debugSessionId="${session?.debuggeeId ?? ''}" ` +
        `programName="${session?.program ?? ''}" includeName="${session?.include ?? ''}" line="${session?.line ?? 0}" ` +
        `isSteppingPossible="${!running}" isTerminationPossible="true" ` +
        `isDebuggeeChanged="${step === 'stepContinue' || step === 'terminateDebuggee' ? 'true' : 'false'}" ` +
        `isPostMortem="false" serverName="mock_server"/>`);
}
/** Listener registration / status / detach (`/debugger/listeners`). */
async function hDebuggerListeners({ req, res, state, url, opts }) {
    const dbg = state.debugger;
    const terminalId = url.searchParams.get('terminalId') ?? '';
    const ideId = url.searchParams.get('ideId') ?? '';
    const user = (url.searchParams.get('requestUser') ?? parseBasicAuth(req)?.username ?? 'DEMO').toUpperCase();
    if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/xml');
        const listeners = [...dbg.listeners.entries()]
            .map(([tid, l]) => `<dbg:listener terminalId="${tid}" ideId="${l.ideId}" user="${l.user}"/>`)
            .join('\n  ');
        res.end(adtXml(`<dbg:listeners xmlns:dbg="${NS_DBG}">\n  ${listeners}\n</dbg:listeners>`));
        return;
    }
    if (req.method === 'DELETE') {
        dbg.listeners.delete(terminalId);
        // Detach releases the stopped debuggee and ends the session; a re-attach
        // is impossible without a fresh listener (real ADT semantics, vsp pitfall).
        if (dbg.session?.terminalId === terminalId)
            dbg.session = undefined;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/xml');
        res.end();
        return;
    }
    // POST: register and wait. Deterministic hit: the next listen after a
    // breakpoint was set catches a debuggee immediately (empty body = timeout).
    dbg.listeners.set(terminalId, { ideId, user });
    if (dbg.pendingHit && !dbg.session && dbg.breakpoints.size > 0) {
        dbg.pendingHit = false;
        const firstBp = [...dbg.breakpoints.values()][0];
        // Derive the program name from the breakpoint's source URI: strip the
        // /source/main suffix, then take the final path segment (the object name).
        const base = firstBp.uri.replace(/\/source\/main$/, '');
        const program = (base.split('/').pop() || 'ZPROG_DEMO').toUpperCase();
        dbg.session = {
            debuggeeId: randomUUID(),
            terminalId,
            program,
            include: program,
            line: firstBp.line,
            user,
            variables: mockDebugVariables(),
            running: false,
        };
        res.setHeader('Content-Type', 'application/xml');
        res.end(debuggeeXml(dbg.session, terminalId, ideId, opts.systemId));
        return;
    }
    // Wait window elapsed without a hit — empty body, HTTP 200.
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    res.end();
}
/** Breakpoint collection (`/debugger/breakpoints` + `/debugger/breakpoints/<id>`). */
async function hDebuggerBreakpoints({ req, res, state, path }) {
    const dbg = state.debugger;
    if (req.method === 'POST') {
        const body = await readBody(req);
        const match = DEBUGGER_BREAKPOINT_URI_RE.exec(body);
        if (!match) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/xml');
            res.end(errorXml('Breakpoint request missing adtcore:uri'));
            return;
        }
        const uri = match[1];
        const line = Number(match[2] ?? 1) || 1;
        const id = `BP${String(++dbg.bpCounter).padStart(4, '0')}`;
        dbg.breakpoints.set(id, { uri, line });
        // External breakpoints persist; the mock makes the NEXT listen catch.
        dbg.pendingHit = true;
        res.setHeader('Content-Type', 'application/xml');
        res.end(adtXml(`<dbg:breakpoints xmlns:dbg="${NS_DBG}" xmlns:adtcore="${NS_ADT}" scope="external">` +
            `<dbg:breakpoint id="${id}" kind="line" adtcore:uri="${xmlEscape(uri)}#start=${line}"/>` +
            `</dbg:breakpoints>`));
        return;
    }
    // DELETE /debugger/breakpoints/<id>
    const id = path.split('/').pop() ?? '';
    if (!dbg.breakpoints.has(id)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Breakpoint ${id} does not exist`));
        return;
    }
    dbg.breakpoints.delete(id);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    res.end();
}
/** The debug loop (`/debugger?method=…`): steps, variables, setVariableValue. */
async function hDebuggerLoop({ req, res, state, url }) {
    const method = url.searchParams.get('method') ?? '';
    const session = state.debugger.session;
    const requireStopped = () => {
        if (!session) {
            throw new MockHttpError(409, 'no active debug session — listen for a breakpoint hit first');
        }
        if (session.running) {
            throw new MockHttpError(409, 'debuggee is running (continued) — wait for the next breakpoint hit');
        }
        return session;
    };
    if (method === 'getVariables') {
        const stopped = requireStopped();
        const body = await readBody(req);
        const wanted = [...body.matchAll(DEBUGGER_VARIABLE_REQUEST_RE)].map((m) => m[1].toUpperCase());
        const vars = wanted
            .map((name) => {
            const v = stopped.variables.get(name);
            if (!v)
                return '';
            return (`<STPDA_ADT_VARIABLE><ID>${name}</ID><NAME>${name}</NAME>` +
                `<DECLARED_TYPE_NAME>${v.type}</DECLARED_TYPE_NAME><ACTUAL_TYPE_NAME>${v.type}</ACTUAL_TYPE_NAME>` +
                `<KIND>V</KIND><VALUE>${xmlEscape(v.value)}</VALUE>` +
                `<READ_ONLY>${v.readOnly ? 'X' : ''}</READ_ONLY>` +
                (name.startsWith('LT_') ? `<TABLE_LINES>3</TABLE_LINES>` : '') +
                `</STPDA_ADT_VARIABLE>`);
        })
            .join('');
        res.setHeader('Content-Type', 'application/xml');
        res.end(abapXml(vars));
        return;
    }
    if (method === 'setVariableValue') {
        const stopped = requireStopped();
        const name = (url.searchParams.get('variableName') ?? '').toUpperCase();
        const value = await readBody(req);
        const v = stopped.variables.get(name);
        if (!v) {
            throw new MockHttpError(404, `variable ${name} not found in this frame`);
        }
        if (v.readOnly) {
            throw new MockHttpError(403, `variable ${name} is read-only`);
        }
        v.value = value;
        res.setHeader('Content-Type', 'application/xml');
        res.end(abapXml(`<RESULT>OK</RESULT>`));
        return;
    }
    // stepInto / stepOver / stepReturn / stepContinue / terminateDebuggee
    const stopped = requireStopped();
    switch (method) {
        case 'stepInto':
        case 'stepOver':
            stopped.line += 1;
            break;
        case 'stepReturn':
            stopped.line += 2;
            break;
        case 'stepContinue':
            stopped.running = true; // debuggee runs free until the next hit
            break;
        case 'terminateDebuggee':
            state.debugger.session = undefined; // session ends with the debuggee
            break;
        default:
            throw new MockHttpError(400, `unsupported debugger method '${method}'`);
    }
    res.setHeader('Content-Type', 'application/xml');
    res.end(debugStepXml(state.debugger.session, method));
}
/** The call stack (`/debugger/stack?method=getStack`). */
function hDebuggerStack({ res, state }) {
    const session = state.debugger.session;
    if (!session || session.running) {
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml('no stopped debuggee — the stack is only readable while paused at a breakpoint'));
        return;
    }
    res.setHeader('Content-Type', 'application/xml');
    res.end(adtXml(`<dbg:stack xmlns:dbg="${NS_DBG}" debugCursorStackIndex="0" serverName="mock_server">` +
        `<dbg:stackEntry stackPosition="1" programName="${session.program}" includeName="${session.include}" ` +
        `line="${session.line}" eventType="PROGRAM" eventName="${session.program}"/>` +
        `<dbg:stackEntry stackPosition="2" programName="SAPLMOCK_CALLER" includeName="SAPLMOCK_CALLER" line="99" ` +
        `eventType="FUNCTION" eventName="MOCK_CALLER"/>` +
        `</dbg:stack>`));
}
// ---- Text elements (plain-text custom format, read-only) ---------------------
/** Textelements subsources served for PROG objects (deterministic fixture). */
function textElementsFixture(subsource) {
    if (subsource === 'symbols') {
        return '@MaxLength:20\r\n001=Demo text symbol\r\n\r\n@MaxLength:30\r\n002=Second symbol';
    }
    if (subsource === 'selections') {
        return 'P_DATE =Processing date\r\n\r\nSO_CARR=Carrier ID';
    }
    return 'listHeader=Demo list header\r\n\r\ncolumnHeader_1=Column one\r\ncolumnHeader_2=Column two';
}
function hTextElements({ res, state, path }) {
    const match = /^\/textelements\/programs\/([^/]+)\/source\/(symbols|selections|headings)$/.exec(path);
    const program = decodeURIComponent(match[1]).toUpperCase();
    if (!findObjectByName(state, program) || findObjectByName(state, program).category !== 'PROG') {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Program ${program} does not exist`));
        return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(textElementsFixture(match[2]));
}
// ---- Object version history (Atom feed) ----
function hVersions({ res, state, path }) {
    const base = path.slice(0, -'/source/main/versions'.length);
    const obj = findObject(state, base);
    if (!obj) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Version history not available for ${path}`));
        return;
    }
    res.setHeader('Content-Type', 'application/atom+xml;type=feed');
    res.end(versionsFeedXml(obj));
}
// ---- Node structure (package content) ----
function hNodeStructure({ res, state, url }) {
    const parentName = (url.searchParams.get('parent_name') ?? '').toUpperCase();
    const parentType = url.searchParams.get('parent_type') ?? '';
    res.setHeader('Content-Type', 'application/vnd.sap.adt.repository.nodestructure.v1+xml');
    if (parentType === 'DEVC/K' || parentName === 'DEVC/K') {
        const members = state.objects
            .filter((o) => o.packageName === parentName)
            .map((o) => `<repo:node repo:name="${o.name}" repo:type="${o.type}" repo:description="${xmlEscape(o.description)}" repo:uri="${o.uri}"/>`)
            .join('\n  ');
        res.end(adtXml(`<repo:nodeStructure xmlns:repo="http://www.sap.com/adt/repository" parent_name="${parentName}" parent_type="DEVC/K">
  ${members}
</repo:nodeStructure>`));
        return;
    }
    res.end(adtXml(`<repo:nodeStructure xmlns:repo="http://www.sap.com/adt/repository"/>`));
}
// ---- Transports ----
function hTransportList({ res, opts }) {
    res.setHeader('Content-Type', 'application/vnd.sap.adt.transportorganizertree.v1+xml');
    res.end(adtXml(`<trs:transportRequests xmlns:trs="http://www.sap.com/adt/cts">
  <trs:request trs:number="S4HK900001" trs:description="Demo request 1" trs:status="M" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000"/>
  <trs:request trs:number="S4HK900002" trs:description="Demo request 2 (released)" trs:status="R" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000" trs:target="QAS"/>
</trs:transportRequests>`));
}
/** A TASK number resolves to its PARENT request (version feeds record
 *  task-level numbers). S4HK900003 is a task of S4HK900001 for testing. */
function transportNumberFor(requested) {
    return requested.toUpperCase() === 'S4HK900003' ? 'S4HK900001' : requested;
}
function hTransportRelease({ res, path, opts }) {
    const transportMatch = TRANSPORT_RE.exec(path);
    const number = transportNumberFor(decodeURIComponent(transportMatch[1]));
    res.setHeader('Content-Type', 'application/vnd.sap.adt.transportorganizer.v1+xml');
    res.end(adtXml(`<trs:request xmlns:trs="http://www.sap.com/adt/cts" trs:number="${number}" trs:description="Released by mock" trs:status="R" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000" trs:target="QAS"/>`));
}
function hTransportDetail({ res, state, path, opts }) {
    const transportMatch = TRANSPORT_RE.exec(path);
    const number = transportNumberFor(decodeURIComponent(transportMatch[1]));
    res.setHeader('Content-Type', 'application/vnd.sap.adt.transportorganizer.v1+xml');
    const items = state.objects
        .slice(0, 3)
        .map((o) => `<trs:item trs:uri="${o.uri}" trs:type="${o.type}" trs:name="${o.name}" trs:description="${xmlEscape(o.description)}" trs:action="I"/>`)
        .join('\n  ');
    res.end(adtXml(`<trs:request xmlns:trs="http://www.sap.com/adt/cts" trs:number="${number}" trs:description="Demo request" trs:status="${number.endsWith('002') ? 'R' : 'M'}" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000">
  ${items}
</trs:request>`));
}
// ---- Object creation (type-specific collections) ----
async function hCreateObject({ res, req, state, url, path }) {
    const createMatch = CREATE_COLLECTIONS.exec(path);
    const body = await readBody(req);
    const nameMatch = /(?:class|intf|prog|ddls|adtcore):name="([^"]+)"/.exec(body) ?? /adtcore:name="([^"]+)"/.exec(body);
    const descMatch = /adtcore:description="([^"]+)"/.exec(body);
    const pkgMatch = /<adtcore:packageRef adtcore:name="([^"]+)"/.exec(body);
    if (!nameMatch) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml('Create request missing name'));
        return;
    }
    const name = nameMatch[1].toUpperCase();
    const type = typeForCollection(createMatch[1]);
    const category = type.split('/')[0];
    if (findObjectByName(state, name)) {
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`Object ${name} already exists`));
        return;
    }
    const obj = {
        uri: uriFor(type, name),
        type,
        category,
        name,
        description: unescapeXml(descMatch?.[1] ?? ''),
        packageName: (pkgMatch?.[1] ?? url.searchParams.get('package') ?? '$TMP').toUpperCase(),
        masterLanguage: 'EN',
        changedAt: new Date().toISOString(),
        changedBy: 'DEMO',
        source: initialSourceFor(type, name),
    };
    // Transport assignment mirrors the real backend: an explicitly-passed
    // corrNr records the object into exactly that request; a transportable
    // package without one gets a NEW auto-created task; $TMP stays local
    // (no transport ever). Exposed in the response so clients can police it.
    const explicitCorrNr = url.searchParams.get('corrNr')?.toUpperCase();
    if (explicitCorrNr)
        obj.corrNr = explicitCorrNr;
    else if (obj.packageName !== '$TMP') {
        obj.corrNr = `MOCKK${String(900000 + Math.floor(Math.random() * 99999))}`;
    }
    state.objects.push(obj);
    res.statusCode = 201;
    res.setHeader('Location', obj.uri);
    res.setHeader('Content-Type', 'application/xml');
    res.end(objectRefXml(obj));
}
// ---- Lock (_action=LOCK) ----
function hLock({ res, req, state, path }) {
    const objByUri = findObject(state, path);
    if (!objByUri)
        return; // unreachable: match verified the object exists
    const user = parseBasicAuth(req)?.username?.toUpperCase() ?? 'DEMO';
    // Lock contention is visible (audit P3 fidelity): like the real backend,
    // a lock held by ANOTHER user answers 403 (EU510) instead of being
    // silently overwritten. Re-locking one's own lock refreshes it.
    const existing = state.locked.get(objByUri.uri);
    if (existing && existing.user && existing.user !== user) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`user ${existing.user} is already editing ${objByUri.name} (lock contention) — ` +
            'wait or coordinate with them (SM12 for force-removal by admins)'));
        return;
    }
    // Like the real backend: an object already belonging to an open request
    // keeps it (its corrNr is returned); only a fresh TRANSPORTABLE object
    // gets a NEW auto-created task — and that assignment persists, so the
    // next lock reports the same request. $TMP objects never get a corrNr.
    if (!objByUri.corrNr && objByUri.packageName !== '$TMP') {
        objByUri.corrNr = `MOCKK${String(900000 + Math.floor(Math.random() * 99999))}`;
    }
    const corrnr = objByUri.corrNr ?? '';
    const handle = randomUUID();
    state.locked.set(objByUri.uri, { handle, corrnr, user });
    res.setHeader('X-ADT-Lock-Handle', handle);
    res.setHeader('Content-Type', 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result');
    res.end(lockResultXml(handle, corrnr));
}
// ---- Unlock (_action=UNLOCK) ----
function hUnlock({ res, state, url, path }) {
    const objByUri = findObject(state, path);
    if (!objByUri)
        return; // unreachable: match verified the object exists
    const lockHandleParam = url.searchParams.get('lockHandle');
    // The handle is validated (audit P3 fidelity): unlocking with a WRONG
    // handle answers 403 like the real backend. A handle-less unlock (same
    // user, used for residual-lock cleanup) stays permissive.
    const existingUnlock = state.locked.get(objByUri.uri);
    if (existingUnlock && lockHandleParam && lockHandleParam !== existingUnlock.handle) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`invalid lock handle for ${objByUri.name} — the lock is held with another handle`));
        return;
    }
    state.locked.delete(objByUri.uri);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result');
    res.end(lockResultXml('', ''));
}
// ---- Object delete (_action=DELETE) ----
function hDeleteObject({ res, state, path }) {
    const objByUri = findObject(state, path);
    if (!objByUri)
        return; // unreachable: match verified the object exists
    state.objects = state.objects.filter((o) => o.uri !== objByUri.uri);
    state.locked.delete(objByUri.uri);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}"/>`));
}
// ---- Object read (base URI or /source/main) ----
function hObjectGet({ res, req, state, url, path }) {
    const srcObj = findObject(state, objectPath(path));
    if (!srcObj)
        return; // unreachable: match verified the object exists
    if (path.endsWith('/source/main')) {
        const version = url.searchParams.get('version');
        // `version=active` reads the last-activated snapshot; plain reads
        // return the current (saved, possibly inactive) source; historical
        // version ids return a deterministic prefixed variant.
        const source = version === 'active'
            ? (srcObj.activeSource ?? srcObj.source)
            : version && version !== '00001'
                ? `* mock version ${version}\n${srcObj.source}`
                : srcObj.source;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(source);
        return;
    }
    // Object metadata (negotiated by Accept): includes lock state.
    if ((req.headers.accept ?? '').includes('object.v1')) {
        res.setHeader('Content-Type', 'application/vnd.sap.adt.object.v1+xml');
        res.end(adtXml(objectRefXml(srcObj, state)));
        return;
    }
    res.setHeader('Content-Type', 'application/xml');
    res.end(sourceXml(srcObj));
}
// ---- Object write (/source/main PUT) ----
async function hSourcePut({ res, req, state, url, path }) {
    const srcObj = findObject(state, objectPath(path));
    if (!srcObj)
        return; // unreachable: match verified the object exists
    const body = await readBody(req);
    const codeMatch = /<[a-z]+:code[^>]*>([\s\S]*?)<\/[a-z]+:code>/.exec(body);
    const source = codeMatch ? unescapeXml(codeMatch[1]) : body;
    srcObj.source = source;
    srcObj.changedAt = new Date().toISOString();
    srcObj.changedBy = 'DEMO';
    // The corrNr of the PUT is the request the change is recorded into —
    // remember it so the next lock reuses it (object joins that open task).
    const corrNr = url.searchParams.get('corrNr');
    if (corrNr)
        srcObj.corrNr = corrNr.toUpperCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}"/>`));
}
// ---- Activation ----
async function hActivation({ res, req, state, url }) {
    const body = await readBody(req);
    const method = url.searchParams.get('method') ?? 'activate';
    const refs = [...body.matchAll(/adtcore:uri="([^"]+)"[^>]*adtcore:name="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    // Resolve each reference ONCE — items and the error aggregate share it.
    const resolved = refs.map(([uri, name]) => ({ uri, name, obj: findObject(state, uri) ?? findObjectByName(state, name) }));
    const items = resolved.map(({ uri, name, obj }) => {
        if (!obj) {
            return `<adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}"/>`;
        }
        if (obj.source.includes('ZBROKEN')) {
            return `<adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}">
    <chkl:messages><chkl:msg type="E"><chkl:shortText><chkl:txt>Syntax error: ZBROKEN is not defined</chkl:txt></chkl:shortText></chkl:msg></chkl:messages>
  </adtcore:objectReference>`;
        }
        // A successful activation promotes the saved source to the active
        // version (checkOnly leaves the active snapshot untouched).
        if (method !== 'check')
            obj.activeSource = obj.source;
        return `<adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:status="${method === 'check' ? 'CHECKED' : 'ACTIVATED'}"/>`;
    });
    const hasError = resolved.some(({ obj }) => !obj || obj.source.includes('ZBROKEN'));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    const messages = hasError
        ? `<chkl:messages xmlns:chkl="${NS_CHKL}"><chkl:msg type="E"><chkl:shortText><chkl:txt>Activation failed for one or more objects</chkl:txt></chkl:shortText></chkl:msg></chkl:messages>`
        : '';
    res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}">
  ${items.join('\n  ')}
</adtcore:objectReferences>${messages}`));
}
// ---- Check run ----
async function hCheckruns({ res, req, state }) {
    const body = await readBody(req);
    const refs = [...body.matchAll(/adtcore:uri="([^"]+)"/g)].map((m) => m[1]);
    const msgs = [];
    for (const uri of refs) {
        const obj = findObject(state, uri);
        if (obj?.source.includes('ZBROKEN')) {
            msgs.push(`<chkl:msg type="E"><chkl:shortText><chkl:txt>Syntax error: ZBROKEN is not defined (${obj.name})</chkl:txt></chkl:shortText></chkl:msg>`);
        }
    }
    res.setHeader('Content-Type', 'application/vnd.sap.adt.checkmessages+xml');
    res.end(adtXml(`<chkl:messages xmlns:chkl="${NS_CHKL}">
  ${msgs.join('\n  ')}
</chkl:messages>`));
}
// ---- ABAP Unit (async run) ----
function hUnitRunLegacy({ res }) {
    // Old backends (BASIS < 7.5x) never registered the async run service.
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/xml');
    res.end(errorXml('Resource not found: /abapunit/runs (legacy backend; use /abapunit/testruns)'));
}
async function hUnitRun({ res, req, state }) {
    const body = await readBody(req);
    const requestedNames = [...body.matchAll(/osl:object name="([^"]+)"/g)].map((m) => m[1].toUpperCase());
    const runId = randomUUID();
    state.unitRuns.set(runId, requestedNames.length ? requestedNames : undefined);
    res.statusCode = 201;
    res.setHeader('Location', `/sap/bc/adt/abapunit/runs/${runId}`);
    res.setHeader('Content-Type', 'application/vnd.sap.adt.api.abapunit.run-status.v1+xml');
    res.end(adtXml(`<aunit:runStatus xmlns:aunit="${NS_AUNIT}" xmlns:atom="http://www.w3.org/2005/Atom" status="completed" completed="true">
  <aunit:id>${runId}</aunit:id>
  <atom:link rel="self" href="/sap/bc/adt/abapunit/runs/${runId}"/>
  <atom:link rel="result" href="/sap/bc/adt/abapunit/results/${runId}"/>
</aunit:runStatus>`));
}
function hUnitStatus({ res, state, path }) {
    const unitStatusMatch = UNIT_RUN_RE.exec(path);
    // Unknown run ids answer 404 (audit P3 fidelity): a made-up id used to
    // fabricate a completed green run.
    if (!state.unitRuns.has(unitStatusMatch[1])) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`ABAP Unit run ${unitStatusMatch[1]} does not exist`));
        return;
    }
    res.setHeader('Content-Type', 'application/vnd.sap.adt.api.abapunit.run-status.v1+xml');
    res.end(adtXml(`<aunit:runStatus xmlns:aunit="${NS_AUNIT}" xmlns:atom="http://www.w3.org/2005/Atom" status="completed" completed="true">
  <aunit:id>${unitStatusMatch[1]}</aunit:id>
  <atom:link rel="result" href="/sap/bc/adt/abapunit/results/${unitStatusMatch[1]}"/>
</aunit:runStatus>`));
}
function hUnitResult({ res, state, opts, path }) {
    const unitResultMatch = UNIT_RESULT_RE.exec(path);
    const runId = unitResultMatch[1];
    if (!state.unitRuns.has(runId)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`ABAP Unit result ${runId} does not exist`));
        return;
    }
    const requested = state.unitRuns.get(runId);
    res.setHeader('Content-Type', 'application/vnd.sap.adt.api.junit.run-result.v1+xml');
    const testCases = [];
    let passed = 0;
    let failed = 0;
    let total = 0;
    const targets = requested
        ? state.objects.filter((o) => requested.includes(o.name.toUpperCase()))
        : state.objects.filter((o) => o.unit);
    for (const obj of targets) {
        if (!obj.unit)
            continue;
        if (obj.unit.failed > 0) {
            total += obj.unit.total;
            failed += obj.unit.failed;
            for (let i = 0; i < obj.unit.total; i++) {
                const name = obj.unit.failedMethod ?? `TEST_${i + 1}`;
                testCases.push(`<testcase asserts="1" time="0.01" name="${name}" classname="${obj.name.toLowerCase()}">
      <failure type="Assert Failure" message="${xmlEscape(obj.unit.failedMessage ?? '')}">expected: &lt;X&gt; but was: &lt;Y&gt;</failure>
    </testcase>`);
            }
        }
        else {
            total += obj.unit.total;
            passed += obj.unit.total;
            for (let i = 0; i < obj.unit.total; i++) {
                testCases.push(`<testcase asserts="1" time="0.01" name="TEST_${i + 1}" classname="${obj.name.toLowerCase()}"/>`);
            }
        }
    }
    res.end(adtXml(`<testsuites tests="${total}" asserts="${total}" skipped="0" errors="0" failures="${failed}" timestamp="2026-08-13T12:00:00Z" time="0.36" executedBy="DEMO" client="000" system="${opts.systemId}">
  <testsuite tests="${total}" asserts="${total}" skipped="0" errors="0" failures="${failed}" name="">
    ${testCases.join('\n    ')}
  </testsuite>
</testsuites>`));
}
// ---- ABAP Unit (legacy synchronous testruns; BASIS < 7.5x) ----
async function hUnitTestruns({ res, req, state }) {
    const body = await readBody(req);
    const uris = [...body.matchAll(/adtcore:uri="([^"]+)"/g)].map((m) => m[1]);
    const targets = uris
        .map((u) => findObject(state, u))
        .filter((o) => Boolean(o?.unit));
    // Legacy backends execute the run synchronously and answer with
    // aunit:runResult (ns http://www.sap.com/adt/aunit) — programs →
    // testClasses → testMethods, alerts carrying severity/title/text.
    const programs = targets.map((obj) => {
        const methods = [];
        for (let i = 0; i < obj.unit.total; i++) {
            const isFailed = i < obj.unit.failed;
            const name = isFailed ? obj.unit.failedMethod ?? `TEST_${i + 1}` : `TEST_${i + 1}`;
            const alert = isFailed
                ? `\n        <aunit:alert kind="assert" severity="critical" title="Assertion failed">${xmlEscape(obj.unit.failedMessage ?? 'expected: <X> but was: <Y>')}</aunit:alert>`
                : '';
            methods.push(`<aunit:testMethod name="${name}" duration="0.01" unit="seconds">${alert}
        </aunit:testMethod>`);
        }
        return `<aunit:program name="${obj.name}" uri="${obj.uri}" type="${obj.category}">
      <aunit:testClasses>
        <aunit:testClass name="LTCL_${obj.name.replace(/[~]/g, '_')}" uri="${obj.uri}" riskLevel="harmless">
          <aunit:testMethods>
        ${methods.join('\n        ')}
          </aunit:testMethods>
        </aunit:testClass>
      </aunit:testClasses>
    </aunit:program>`;
    });
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.end(adtXml(`<aunit:runResult xmlns:aunit="${NS_AUNIT_LEGACY}">
  ${programs.join('\n  ')}
</aunit:runResult>`));
}
// ---- ATC (async run) ----
async function hAtcRun({ res, state }) {
    const runId = randomUUID();
    state.atcRunIds.add(runId);
    state.atcRunIds.add(`A${runId.slice(1)}`.toUpperCase());
    res.statusCode = 201;
    res.setHeader('Location', `/sap/bc/adt/atc/runs/${runId}`);
    res.setHeader('Content-Type', 'application/vnd.sap.atc.run.v1+xml');
    res.end(adtXml(`<atc:run xmlns:atc="${NS_ATC}" xmlns:atom="http://www.w3.org/2005/Atom" state="completed">
  <atc:id>${runId}</atc:id>
  <atc:displayId>${runId}</atc:displayId>
  <atom:link rel="result" href="/sap/bc/adt/atc/results/${runId}"/>
</atc:run>`));
}
function hAtcStatus({ res, path }) {
    const atcStatusMatch = ATC_RUN_RE.exec(path);
    // Mirror the real backend shape: `status` attribute, phases, and a result
    // link whose id DIFFERS from the run id (exercises link extraction).
    const runId = atcStatusMatch[1];
    const resultId = `A${runId.slice(1)}`.toUpperCase();
    res.setHeader('Content-Type', 'application/vnd.sap.atc.run.v1+xml');
    res.end(adtXml(`<atc:run xmlns:atc="${NS_ATC}" xmlns:atom="http://www.w3.org/2005/Atom" status="Completed">
  <atc:id>${runId}</atc:id>
  <atc:progress description="Run Completed"/>
  <atc:phases>
    <atc:phase title="Determine Object Keys" status="Completed" number="1"/>
    <atc:phase title="Check Objects" status="Completed" number="2"/>
    <atc:phase title="Completion Phase" status="Completed" number="3"/>
  </atc:phases>
  <atom:link href="/sap/bc/adt/atc/results/${resultId}" rel="http://www.sap.com/abap/checks/atc/relations/result"/>
</atc:run>`));
}
// ---- ATC results collection (list existing runs) ----
function hAtcResultsList({ res, url }) {
    const createdBy = (url.searchParams.get('createdBy') ?? 'DEMO').toUpperCase();
    res.setHeader('Content-Type', 'application/xml');
    const runs = ATC_SAMPLE_RUNS.filter((r) => !createdBy || r.createdBy.toUpperCase() === createdBy || createdBy === '*')
        .map((r) => `<atcresult:result displayId="${r.displayId}" createdBy="${r.createdBy}" createdAt="${r.createdAt}" status="COMPLETED"/>`)
        .join('\n  ');
    res.end(adtXml(`<atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result">
  ${runs}
</atcresult:resultList>`));
}
function hAtcResultDetail({ res, state, path }) {
    const atcResultMatch = ATC_RESULT_RE.exec(path);
    const displayId = atcResultMatch[1].toUpperCase();
    const sample = ATC_SAMPLE_RUNS.find((r) => r.displayId.toUpperCase() === displayId);
    const fromAsyncRun = state.atcRunIds.has(atcResultMatch[1]);
    if (!sample && !fromAsyncRun) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/xml');
        res.end(errorXml(`ATC result ${displayId} does not exist`));
        return;
    }
    const scope = sample ? sample.scope : undefined;
    const targets = scope
        ? state.objects.filter((o) => scope.includes(o.name.toUpperCase()))
        : state.objects.filter((o) => o.atcFindings && o.atcFindings.length > 0);
    // Object URIs follow the object's TYPE (audit P3 fidelity): the old code
    // hardcoded /oo/classes/ for every object, so PROG findings carried a
    // class URI.
    const atcSourceUri = (o) => {
        const base = uriFor(o.type, o.name.toLowerCase());
        return `${base}/source/main`;
    };
    // Real-backend shape: resultList → result → objects → object → findings.
    res.setHeader('Content-Type', 'application/xml');
    const priorityOf = (severity) => severity === 'CRITICAL' ? 1 : severity === 'ERROR' ? 2 : severity === 'WARNING' ? 3 : 4;
    const objectsXml = targets
        .map((o) => {
        const findings = (o.atcFindings ?? [])
            .map((f, i) => {
            const priority = priorityOf(f.severity);
            // A finding's location may point at ANOTHER object (e.g. an
            // include) while the finding itself hangs on this object's name.
            const locationUri = f.uri ?? atcSourceUri(o);
            return `<atcfinding:finding adtcore:uri="/sap/bc/adt/atc/findings/itemid/${displayId}/index/${i + 1}" atcfinding:location="${locationUri}#start=${f.line ?? 1},0" atcfinding:priority="${priority}" atcfinding:checkId="${f.check}" atcfinding:checkTitle="${xmlEscape(f.checkTitle)}" atcfinding:messageId="${f.check}" atcfinding:messageTitle="${xmlEscape(f.message)}" xmlns:atcfinding="http://www.sap.com/adt/atc/finding" xmlns:adtcore="http://www.sap.com/adt/core"/>`;
        })
            .join('\n      ');
        return `<atcobject:object adtcore:uri="${atcSourceUri(o)}" adtcore:type="${o.category}" adtcore:name="${o.name}" adtcore:packageName="${o.packageName}" atcobject:author="DEMO" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
      <atcobject:findings>${findings}</atcobject:findings>
    </atcobject:object>`;
    })
        .join('\n  ');
    const counts = { p1: 0, p2: 0, p3: 0, p4: 0 };
    for (const o of targets) {
        for (const f of o.atcFindings ?? []) {
            counts[`p${priorityOf(f.severity)}`]++;
        }
    }
    res.end(adtXml(`<atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result" xmlns:adtcore="http://www.sap.com/adt/core">
  <atcresult:result>
    <atcresult:displayId>${displayId}</atcresult:displayId>
    <atcresult:title>Mock ATC run ${displayId.slice(0, 8)}</atcresult:title>
    <atcresult:checkVariant>DEFAULT</atcresult:checkVariant>
    <atcresult:createdAt>2026-08-13T12:00:00Z</atcresult:createdAt>
    <atcresult:aggregates>
      <atcresult:numPrio1>${counts.p1}</atcresult:numPrio1>
      <atcresult:numPrio2>${counts.p2}</atcresult:numPrio2>
      <atcresult:numPrio3>${counts.p3}</atcresult:numPrio3>
      <atcresult:numPrio4>${counts.p4}</atcresult:numPrio4>
      <atcresult:numFailure>0</atcresult:numFailure>
    </atcresult:aggregates>
    <atcresult:objects>
  ${objectsXml}
    </atcresult:objects>
  </atcresult:result>
</atcresult:resultList>`));
}
// --- The route table (dispatch order matters — do not reorder) ---------------
const CREATE_COLLECTIONS = /^\/(oo\/classes|oo\/interfaces|programs\/programs|ddls\/sources|ddic\/tables|ddic\/structures|ddic\/domains|ddic\/dataelements|ddic\/tabletypes|messageclass|msgclass|packages)$/;
const TRANSPORT_RE = /^\/cts\/transportrequests\/([^/]+)(?:\/(release))?$/;
// Route regexes are shared between the table entry and its handler — the
// handlers' `match![1]!` captures rely on the two never drifting apart.
const DATA_PREVIEW_DDIC_RE = /^\/datapreview\/ddic\/([^/]+)$/;
const DATA_PREVIEW_CDS_RE = /^\/datapreview\/cds\/([^/]+)$/;
const DUMP_RE = /^\/runtime\/dump\/([^/]+?)(?:\/(summary|formatted))?$/;
const PROGRAM_RUN_RE = /^\/programs\/programrun\/([^/]+)$/;
const CLASS_RUN_RE = /^\/oo\/classrun\/([^/]+)$/;
const UNIT_RUN_RE = /^\/abapunit\/runs\/([^/]+)$/;
const UNIT_RESULT_RE = /^\/abapunit\/results\/([^/]+)$/;
const ATC_RUN_RE = /^\/atc\/runs\/([^/]+)$/;
const ATC_RESULT_RE = /^\/atc\/results\/([^/]+)$/;
const DEBUGGER_BREAKPOINT_ID_RE = /^\/debugger\/breakpoints\/[^/]+$/;
/** Object base URI: strips a trailing `/source/main` (source-form URIs). */
const objectPath = (path) => path.endsWith('/source/main') ? path.slice(0, -'/source/main'.length) : path;
const ROUTES = [
    // Discovery / search / where-used
    { method: 'GET', match: (c) => c.path === '/core/discovery' || c.path === '/discovery', handler: hDiscovery },
    { method: 'GET', match: (c) => c.path === '/repository/informationsystem/search', handler: hSearch },
    { method: 'GET', match: (c) => c.path === '/repository/informationsystem/usageReferences', handler: hWhereUsed },
    // Data preview
    {
        method: 'GET',
        match: (c) => DATA_PREVIEW_DDIC_RE.test(c.path) || DATA_PREVIEW_CDS_RE.test(c.path),
        handler: hDataPreview,
    },
    { method: 'GET', match: (c) => c.path === '/datapreview/freestyle', handler: hDataPreviewFreestyle },
    // Runtime dumps
    { method: 'GET', match: (c) => c.path === '/runtime/dumps', handler: hDumpsList },
    { method: 'GET', match: (c) => DUMP_RE.test(c.path), handler: hDumpDetail },
    // Program / class execution
    { method: 'POST', csrf: true, match: (c) => PROGRAM_RUN_RE.test(c.path), handler: hProgramRun },
    { method: 'POST', csrf: true, match: (c) => CLASS_RUN_RE.test(c.path), handler: hClassRun },
    // Protocol-level $batch
    { method: 'POST', csrf: true, match: (c) => c.path === '/$batch', handler: hBatch },
    // Structured metadata editors (must precede the generic object routes)
    { method: 'GET', match: (c) => structuredObjectFor(c) !== undefined, handler: hStructuredGet },
    { method: 'PUT', csrf: true, match: (c) => structuredObjectFor(c) !== undefined, handler: hStructuredPut },
    // Version history / node structure
    { method: 'GET', match: (c) => c.path.endsWith('/source/main/versions'), handler: hVersions },
    { method: 'GET', match: (c) => c.path === '/repository/nodestructure', handler: hNodeStructure },
    // Transports (detail answers any method, like the current behavior)
    { method: 'GET', match: (c) => c.path === '/cts/transportrequests', handler: hTransportList },
    {
        method: 'POST',
        csrf: true,
        wrongMethodStatus: 405,
        label: 'transport release',
        match: (c) => TRANSPORT_RE.test(c.path) && c.path.endsWith('/release'),
        handler: hTransportRelease,
    },
    { method: '*', match: (c) => TRANSPORT_RE.test(c.path), handler: hTransportDetail },
    // Object creation
    { method: 'POST', csrf: true, match: (c) => CREATE_COLLECTIONS.test(c.path), handler: hCreateObject },
    // Lock / unlock / delete (query-param actions on an existing object)
    {
        method: 'POST',
        csrf: true,
        match: (c) => c.url.searchParams.get('_action') === 'LOCK' && findObject(c.state, c.path) !== undefined,
        handler: hLock,
    },
    {
        method: 'POST',
        csrf: true,
        match: (c) => c.url.searchParams.get('_action') === 'UNLOCK' && findObject(c.state, c.path) !== undefined,
        handler: hUnlock,
    },
    {
        method: 'POST',
        csrf: true,
        match: (c) => c.url.searchParams.get('_action') === 'DELETE' && findObject(c.state, c.path) !== undefined,
        handler: hDeleteObject,
    },
    // Object read (base URI or /source/main) and source write
    { method: 'GET', match: (c) => findObject(c.state, objectPath(c.path)) !== undefined, handler: hObjectGet },
    {
        method: 'PUT',
        csrf: true,
        match: (c) => c.path.endsWith('/source/main') && findObject(c.state, objectPath(c.path)) !== undefined,
        handler: hSourcePut,
    },
    // Activation / check
    { method: 'POST', csrf: true, match: (c) => c.path === '/repository/activation', handler: hActivation },
    { method: 'POST', csrf: true, match: (c) => c.path === '/checkruns', handler: hCheckruns },
    // ABAP Unit: legacy backends 404 the async service (checked BEFORE CSRF,
    // like the original code); otherwise the async run flow.
    { method: 'POST', match: (c) => c.opts.legacyUnitOnly && c.path === '/abapunit/runs', handler: hUnitRunLegacy },
    { method: 'POST', csrf: true, match: (c) => c.path === '/abapunit/runs', handler: hUnitRun },
    { method: 'GET', match: (c) => UNIT_RUN_RE.test(c.path), handler: hUnitStatus },
    { method: 'GET', match: (c) => UNIT_RESULT_RE.test(c.path), handler: hUnitResult },
    { method: 'POST', csrf: true, match: (c) => c.path === '/abapunit/testruns', handler: hUnitTestruns },
    // ATC
    { method: 'POST', csrf: true, match: (c) => c.path === '/atc/runs', handler: hAtcRun },
    { method: 'GET', match: (c) => ATC_RUN_RE.test(c.path), handler: hAtcStatus },
    { method: 'GET', match: (c) => c.path === '/atc/results', handler: hAtcResultsList },
    { method: 'GET', match: (c) => ATC_RESULT_RE.test(c.path), handler: hAtcResultDetail },
    // Debugger (standard ADT REST debugger state machine)
    {
        method: 'POST',
        csrf: true,
        match: (c) => c.path === '/debugger/listeners',
        handler: hDebuggerListeners,
    },
    { method: 'GET', match: (c) => c.path === '/debugger/listeners', handler: hDebuggerListeners },
    {
        method: 'DELETE',
        csrf: true,
        match: (c) => c.path === '/debugger/listeners',
        handler: hDebuggerListeners,
    },
    {
        method: 'POST',
        csrf: true,
        match: (c) => c.path === '/debugger/breakpoints',
        handler: hDebuggerBreakpoints,
    },
    {
        method: 'DELETE',
        csrf: true,
        match: (c) => DEBUGGER_BREAKPOINT_ID_RE.test(c.path),
        handler: hDebuggerBreakpoints,
    },
    {
        method: 'POST',
        csrf: true,
        match: (c) => c.path === '/debugger' && c.url.searchParams.has('method'),
        handler: hDebuggerLoop,
    },
    {
        method: 'POST',
        csrf: true,
        match: (c) => c.path === '/debugger/stack' && c.url.searchParams.get('method') === 'getStack',
        handler: hDebuggerStack,
    },
    // Text elements (read-only plain-text subsources)
    {
        method: 'GET',
        match: (c) => /^\/textelements\/programs\/[^/]+\/source\/(symbols|selections|headings)$/.test(c.path),
        handler: hTextElements,
    },
];
// --- Structured metadata editors (MSAG / DOMA / DTEL / TTYP) -----------------
/** Media types of the structured kinds (mirrors @nefevcore/abap-adt-protocol). */
const STRUCTURED_MEDIA = {
    MSAG: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml',
    DOMA: 'application/vnd.sap.adt.domains.v2+xml',
    DTEL: 'application/vnd.sap.adt.dataelements.v2+xml',
    TTYP: 'application/vnd.sap.adt.tabletypes.v2+xml',
};
/** Does this request negotiate a structured editor representation? */
function structuredKindFor(obj, accept, method) {
    if (!obj || accept === undefined || (method !== 'GET' && method !== 'PUT'))
        return undefined;
    const category = obj.category;
    if (!(category in STRUCTURED_MEDIA))
        return undefined;
    const media = STRUCTURED_MEDIA[category];
    // Match when the Accept header carries the kind-specific media type (or a
    // wildcard that the generic object handler would not claim more strongly).
    const acceptsStructured = media
        .split(',')
        .some((m) => accept.includes(m.trim()))
        || (category === 'MSAG' && accept.includes('mc.messageclass'));
    if (acceptsStructured)
        return category;
    // A bare `application/xml` GET is ambiguous — the generic handler serves it.
    return undefined;
}
/** Minimal structured skeleton for objects created without metadata XML. */
function defaultMetadataXml(obj) {
    const head = ` adtcore:name="${obj.name}" adtcore:type="${obj.type}" adtcore:description="${xmlEscape(obj.description)}"` +
        ` adtcore:language="${obj.masterLanguage}" adtcore:masterLanguage="${obj.masterLanguage}"`;
    const pkg = `  <adtcore:packageRef adtcore:name="${obj.packageName}"/>`;
    switch (obj.category) {
        case 'MSAG':
            return `<?xml version="1.0" encoding="UTF-8"?>\n<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core"${head}>\n${pkg}\n</mc:messageClass>`;
        case 'DOMA':
            return `<?xml version="1.0" encoding="UTF-8"?>\n<doma:domain xmlns:doma="http://www.sap.com/adt/ddic/Domains" xmlns:adtcore="http://www.sap.com/adt/core"${head}>\n${pkg}\n  <doma:content>\n    <doma:typeInformation>\n      <doma:datatype>CHAR</doma:datatype>\n      <doma:length>10</doma:length>\n      <doma:decimals>0</doma:decimals>\n    </doma:typeInformation>\n    <doma:fixValues/>\n  </doma:content>\n</doma:domain>`;
        case 'DTEL':
            return `<?xml version="1.0" encoding="UTF-8"?>\n<dtel:dataElement xmlns:dtel="http://www.sap.com/adt/ddic/DataElements" xmlns:adtcore="http://www.sap.com/adt/core"${head}>\n${pkg}\n  <dtel:typeKind>builtin</dtel:typeKind>\n  <dtel:dataType>CHAR</dtel:dataType>\n  <dtel:dataTypeLength>000010</dtel:dataTypeLength>\n  <dtel:labels/>\n</dtel:dataElement>`;
        default:
            return `<?xml version="1.0" encoding="UTF-8"?>\n<ttypes:tableType xmlns:ttypes="http://www.sap.com/adt/ddic/TableTypes" xmlns:ttyp="http://www.sap.com/adt/ddic/TableTypes" xmlns:adtcore="http://www.sap.com/adt/core"${head}>\n${pkg}\n  <ttyp:typeKind>builtin</ttyp:typeKind>\n  <ttyp:dataType>STRING</ttyp:dataType>\n  <ttyp:accessType>standard</ttyp:accessType>\n</ttypes:tableType>`;
    }
}
// --- $batch inner dispatch ----------------------------------------------------
const HTTP_STATUS_TEXT = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    409: 'Conflict',
    500: 'Internal Server Error',
};
/**
 * Re-dispatch one embedded `$batch` request through the regular mock handler
 * using stub req/res objects that inherit the outer session (cookies, auth,
 * CSRF token), then collect the response for the multipart envelope.
 */
async function dispatchInner(outer, state, opts, method, pathWithQuery, body, accept) {
    const headers = {};
    for (const [key, value] of Object.entries(outer.headers)) {
        if (typeof value !== 'string')
            continue;
        if (['content-type', 'content-length', 'host', 'connection'].includes(key))
            continue;
        headers[key] = value;
    }
    if (accept)
        headers.accept = accept;
    let statusCode = 200;
    let responseBody = '';
    const stubReq = {
        method,
        url: pathWithQuery,
        headers,
        async *[Symbol.asyncIterator]() {
            if (body !== undefined && body.length > 0)
                yield Buffer.from(body, 'utf8');
        },
    };
    const outHeaders = {};
    const stubRes = {
        get statusCode() {
            return statusCode;
        },
        set statusCode(value) {
            statusCode = value;
        },
        setHeader(key, value) {
            outHeaders[String(key).toLowerCase()] = String(value);
        },
        getHeader(key) {
            return outHeaders[String(key).toLowerCase()];
        },
        removeHeader(key) {
            delete outHeaders[String(key).toLowerCase()];
        },
        end(chunk) {
            if (chunk !== undefined)
                responseBody = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        },
    };
    await handle(stubReq, stubRes, state, opts);
    const emitted = {};
    for (const [key, value] of Object.entries(outHeaders)) {
        if (key.startsWith('access-control-') || key === 'content-length' || key === 'set-cookie')
            continue;
        emitted[key] = value;
    }
    return { statusCode, statusText: HTTP_STATUS_TEXT[statusCode] ?? '', headers: emitted, body: responseBody };
}
function typeForCollection(collection) {
    switch (collection) {
        case 'oo/classes':
            return 'CLAS/OC';
        case 'oo/interfaces':
            return 'INTF/OI';
        case 'programs/programs':
            return 'PROG/P';
        case 'ddls/sources':
            return 'DDLS/DF';
        case 'ddic/tables':
            return 'TABL/DT';
        case 'ddic/structures':
            return 'STRU/DT';
        case 'ddic/domains':
            return 'DOMA/DT';
        case 'ddic/dataelements':
            return 'DTEL/DT';
        case 'ddic/tabletypes':
            return 'TTYP/DT';
        case 'msgclass':
        case 'messageclass':
            return 'MSAG/N';
        case 'packages':
            return 'DEVC/K';
        default:
            return 'CLAS/OC';
    }
}
function unescapeXml(text) {
    return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
/** Build a case-insensitive matcher honoring `*` wildcards (like ADT search). */
function wildcardMatcher(query) {
    const lower = query.toLowerCase();
    if (!lower.includes('*'))
        return (value) => value.toLowerCase().includes(lower);
    const escaped = lower.split('*').map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('.*');
    const re = new RegExp(`^${escaped}$`);
    return (value) => re.test(value.toLowerCase());
}
function uriFor(type, name) {
    const cat = type.split('/')[0];
    switch (cat) {
        case 'CLAS':
            return `/sap/bc/adt/oo/classes/${name.toLowerCase()}`;
        case 'INTF':
            return `/sap/bc/adt/oo/interfaces/${name.toLowerCase()}`;
        case 'PROG':
            // Includes (PROG/I) live in their own namespace — /programs/includes/.
            return type === 'PROG/I'
                ? `/sap/bc/adt/programs/includes/${name.toLowerCase()}`
                : `/sap/bc/adt/programs/programs/${name.toLowerCase()}`;
        case 'DDLS':
            return `/sap/bc/adt/ddls/sources/${name.toLowerCase()}`;
        case 'TABL':
            return `/sap/bc/adt/ddic/tables/${name.toLowerCase()}`;
        case 'STRU':
            return `/sap/bc/adt/ddic/structures/${name.toLowerCase()}`;
        case 'DOMA':
            return `/sap/bc/adt/ddic/domains/${name.toLowerCase()}`;
        case 'DTEL':
            return `/sap/bc/adt/ddic/dataelements/${name.toLowerCase()}`;
        case 'TTYP':
            return `/sap/bc/adt/ddic/tabletypes/${name.toLowerCase()}`;
        case 'MSAG':
            return `/sap/bc/adt/msgclass/${name.toLowerCase()}`;
        case 'DEVC':
            return `/sap/bc/adt/packages/${name.toLowerCase()}`;
        default:
            return `/sap/bc/adt/repository/objects/${name.toLowerCase()}`;
    }
}
function initialSourceFor(type, name) {
    const cat = type.split('/')[0];
    switch (cat) {
        case 'CLAS':
            return `CLASS ${name} DEFINITION PUBLIC CREATE PUBLIC.\n  PUBLIC SECTION.\n  PROTECTED SECTION.\n  PRIVATE SECTION.\nENDCLASS.\n\nCLASS ${name} IMPLEMENTATION.\nENDCLASS.`;
        case 'INTF':
            return `INTERFACE ${name} PUBLIC.\nENDINTERFACE.`;
        case 'PROG':
            return `REPORT ${name}.\n\nWRITE / 'Hello'.`;
        case 'DDLS':
            return `@EndUserText.label: '${name}'\ndefine view ${name} as select from t100\n{\n  key msgno,\n      text\n}`;
        case 'DOMA':
            return `DOMAIN ${name}.\n  DATA: length TYPE i VALUE 10.\nENDDOMAIN.`;
        case 'DTEL':
            return `DATA ELEMENT ${name}.\n  DOMAIN: sychar10.`;
        case 'TTYP':
            return `TABLE TYPE ${name}.\n  LINE TYPE: string.`;
        default:
            return `* ${name}`;
    }
}
//# sourceMappingURL=server.js.map