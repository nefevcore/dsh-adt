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
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ADT_BASE } from '@nefevcore/abap-adt-protocol';
import { DUMPS, OBJECTS, PACKAGES, type MockDump, type MockObject } from './data.js';

export interface MockAdtOptions {
  port?: number;
  host?: string;
  /** Username/password required by Basic auth (default: any). */
  username?: string;
  password?: string;
  systemId?: string;
  release?: string;
  /**
   * Simulate an old / restricted backend (BASIS < 7.5x, verified against a
   * real NW 7.4x system): the async `/abapunit/runs` service is absent
   * (404) and ABAP Unit runs only via the synchronous `/abapunit/testruns`
   * endpoint, which returns `aunit:runResult` directly in the POST response.
   */
  legacyUnitOnly?: boolean;
}

const NS_ADT = 'http://www.sap.com/adt/core';
const NS_ASX = 'http://www.sap.com/abapxml';
const NS_EXC = 'http://www.sap.com/adt/xml/exception';
const NS_CHKL = 'http://www.sap.com/adt/checkresult';
const NS_CHKRUN = 'http://www.sap.com/adt/checkrun';
const NS_AUNIT = 'http://www.sap.com/adt/api/aunit';
const NS_AUNIT_LEGACY = 'http://www.sap.com/adt/aunit';
const NS_ATC = 'http://www.sap.com/adt/atc';

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function adtXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

function errorXml(text: string, type = 'E'): string {
  return adtXml(
    `<exc:exception xmlns:exc="${NS_EXC}" exc:type="${type}"><exc:message>${xmlEscape(text)}</exc:message><exc:localizedMessage>${xmlEscape(text)}</exc:localizedMessage></exc:exception>`,
  );
}

function sourceXml(obj: MockObject): string {
  return adtXml(
    `<adt:object xmlns:adt="${NS_ADT}" uri="${obj.uri}" type="${obj.type}" name="${obj.name}" description="${xmlEscape(obj.description)}" changedAt="${obj.changedAt}" changedBy="${obj.changedBy}" masterLanguage="${obj.masterLanguage}">
  <adt:code>${xmlEscape(obj.source)}</adt:code>
</adt:object>`,
  );
}

function objectRefXml(obj: MockObject, state?: MockState): string {
  const lock = state?.locked.get(obj.uri);
  const lockedBy = lock?.user ? ` adtcore:lockedBy="${lock.user}"` : '';
  return `<adtcore:objectReference adtcore:uri="${obj.uri}" adtcore:type="${obj.type}" adtcore:name="${obj.name}" adtcore:description="${xmlEscape(obj.description)}" adtcore:packageName="${obj.packageName}"${lockedBy}/>`;
}

/** Lock attribute fragment for metadata responses (empty when unlocked). */
function lockAttr(state: MockState, obj: MockObject): string {
  const lock = state.locked.get(obj.uri);
  return lock?.user ? ` adtcore:lockedBy="${lock.user}"` : '';
}

/** Sample where-used references keyed by object name (uppercased). */
const WHERE_USED: Record<string, Array<{ name: string; type: string; uri: string; packageName: string; responsible: string; usageInformation: string }>> = {
  ZCL_DEMO: [
    { name: 'ZPROG_DEMO', type: 'PROG/P', uri: '/sap/bc/adt/programs/programs/zprog_demo', packageName: 'ZPACK_DEMO', responsible: 'DEMO', usageInformation: 'method call' },
    { name: 'ZCL_FLAKY', type: 'CLAS/OC', uri: '/sap/bc/adt/oo/classes/zcl_flaky', packageName: 'ZPACK_DEMO', responsible: 'DEMO', usageInformation: 'instantiation' },
  ],
  ZIF_DEMO: [
    { name: 'ZCL_DEMO', type: 'CLAS/OC', uri: '/sap/bc/adt/oo/classes/zcl_demo', packageName: 'ZPACK_DEMO', responsible: 'DEMO', usageInformation: 'implements' },
  ],
};

/**
 * Data-preview sample payload (dataPreview: namespace, column-major layout).
 * Generates `rows` deterministic rows so offset/length paging is verifiable;
 * `totalRows` reports a larger virtual total like a real table would.
 */
function dataPreviewXml(entity: string, query = '', rows = 2): string {
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
function versionsFeedXml(obj: MockObject): string {
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

function lockResultXml(handle: string, corrnr: string): string {
  return adtXml(
    `<asx:abap xmlns:asx="${NS_ASX}" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE>${handle}</LOCK_HANDLE>
      <CORRNR>${corrnr}</CORRNR>
    </DATA>
  </asx:values>
</asx:abap>`,
  );
}

interface MockState {
  objects: MockObject[];
  locked: Map<string, { handle: string; corrnr: string; user?: string }>;
  csrfToken: string;
  sessions: Set<string>;
  /** ABAP Unit run id → requested object names (uppercased). */
  unitRuns: Map<string, string[] | undefined>;
  /** ATC run ids issued by the async run flow. */
  atcRunIds: Set<string>;
}

/** Deterministic stored ATC runs exposed by the results collection. */
const ATC_SAMPLE_RUNS: Array<{ displayId: string; createdBy: string; createdAt: string; scope: string[] }> = [
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

export function createMockAdtServer(options: MockAdtOptions = {}) {
  const state: MockState = {
    objects: OBJECTS.map((o) => ({ ...o })),
    locked: new Map(),
    csrfToken: randomUUID(),
    sessions: new Set(),
    unitRuns: new Map(),
    atcRunIds: new Set(),
  };

  const systemId = options.systemId ?? 'MOCK';
  const release = options.release ?? '757';

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      await handle(req, res, state, {
        state,
        systemId,
        release,
        username: options.username,
        password: options.password,
        legacyUnitOnly: options.legacyUnitOnly ?? false,
      });
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/xml');
      res.end(errorXml(`Internal mock error: ${(error as Error).message}`));
    }
  });

  return {
    server,
    state,
    async listen(port = options.port ?? 8123): Promise<number> {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, options.host ?? '127.0.0.1', () => resolve());
      });
      const address = server.address();
      return typeof address === 'object' && address ? address.port : port;
    },
    close(): Promise<void> {
      return new Promise((resolve) => server.close(() => resolve()));
    },
    /** Access the in-memory object store (tests). */
    get objects() {
      return state.objects;
    },
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function parseBasicAuth(req: IncomingMessage): { username: string; password: string } | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) return undefined;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) return undefined;
  return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
}

function setSession(req: IncomingMessage, res: ServerResponse, state: MockState): void {
  const cookie = req.headers.cookie ?? '';
  if (cookie.includes('SAP_SESSIONID_MOCK')) return;
  const id = randomUUID().replace(/-/g, '').toUpperCase();
  state.sessions.add(id);
  res.setHeader('Set-Cookie', `SAP_SESSIONID_MOCK_000=${id}; Path=/; HttpOnly`);
}

function isStateChanging(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function checkCsrf(req: IncomingMessage, res: ServerResponse, state: MockState): boolean {
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

function findObject(state: MockState, uri: string): MockObject | undefined {
  const candidates = [uri, uri.startsWith(ADT_BASE) ? uri : `${ADT_BASE}${uri}`];
  return state.objects.find((o) => candidates.includes(o.uri));
}

function findObjectByName(state: MockState, name: string): MockObject | undefined {
  const upper = name.toUpperCase();
  return state.objects.find((o) => o.name.toUpperCase() === upper);
}

interface Ctx {
  state: MockState;
  systemId: string;
  release: string;
  username?: string;
  password?: string;
  legacyUnitOnly: boolean;
}

async function handle(req: IncomingMessage, res: ServerResponse, state: MockState, opts: Ctx): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-CSRF-Token, sap-adt-connection-id, x-sap-adt-sessiontype');
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
  if (path.startsWith(ADT_BASE)) path = path.slice(ADT_BASE.length) || '/';

  if (req.headers['x-csrf-token'] === 'fetch') {
    res.setHeader('X-CSRF-Token', state.csrfToken);
  }

  // ---- Discovery (AtomPub service doc) ----
  if (path === '/core/discovery' || path === '/discovery') {
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
      .map(
        ([href, accept, title]) =>
          `<app:collection href="${href}"><atom:title>${title}</atom:title><app:accept>${accept}</app:accept></app:collection>`,
      )
      .join('\n    ');
    res.end(
      adtXml(
        `<app:service xmlns:app="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom">
  <app:workspace>
    <atom:title>${opts.systemId}</atom:title>
    ${collections}
  </app:workspace>
  <feature id="systemId">${opts.systemId}</feature>
  <feature id="release">${opts.release}</feature>
  <feature id="SAP_SYSTEM_NAME">${opts.systemId}</feature>
</app:service>`,
      ),
    );
    return;
  }

  // ---- Search ----
  if (path === '/repository/informationsystem/search') {
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const operation = url.searchParams.get('operation') ?? 'quickSearch';
    const maxResults = Number(url.searchParams.get('maxResults') ?? 25);
    res.setHeader('Content-Type', 'application/xml');
    // Wildcard-aware matching: `Z*` / `*DEMO*` behave like the real ADT search.
    const matcher = wildcardMatcher(query);
    const packageFilter = url.searchParams.get('packageName')?.toUpperCase();
    const inPackage = (o: { packageName: string }): boolean => !packageFilter || o.packageName === packageFilter;
    const objectHits = state.objects
      .filter((o) => inPackage(o) && (matcher(o.name) || matcher(o.description)))
      .slice(0, maxResults);
    const sourceHits =
      (operation === 'quickSearchSource' || operation === 'quickSearch') && !packageFilter
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
    res.end(
      adtXml(
        `<adtcore:objectReferences xmlns:adtcore="${NS_ADT}">
  ${objectXml}
  ${sourceXmlHits}
</adtcore:objectReferences>`,
      ),
    );
    return;
  }

  // ---- Where-used (usage references) ----
  if (path === '/repository/informationsystem/usageReferences') {
    const uri = url.searchParams.get('uri') ?? '';
    const obj = findObject(state, uri);
    const refs = obj ? (WHERE_USED[obj.name.toUpperCase()] ?? []) : [];
    res.setHeader('Content-Type', 'application/xml');
    res.end(
      adtXml(
        `<usagereferences:usageReferenceResult xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences">
  <usagereferences:totalReferences>${refs.length}</usagereferences:totalReferences>
  <usagereferences:references>
    ${refs
      .map(
        (r) =>
          `<usagereferences:reference name="${r.name}" type="${r.type}" uri="${r.uri}" packageName="${r.packageName}" responsible="${r.responsible}" usageInformation="${r.usageInformation}"/>`,
      )
      .join('\n    ')}
  </usagereferences:references>
</usagereferences:usageReferenceResult>`,
      ),
    );
    return;
  }

  // ---- Data preview (ddic / cds / freestyle SQL) ----
  const dpDdic = /^\/datapreview\/ddic\/([^/]+)$/.exec(path);
  const dpCds = /^\/datapreview\/cds\/([^/]+)$/.exec(path);
  if (dpDdic || dpCds) {
    const name = (dpDdic?.[1] ?? dpCds?.[1] ?? '').toUpperCase();
    const rowNumber = Number(url.searchParams.get('rowNumber') ?? 2) || 2;
    res.setHeader('Content-Type', 'application/vnd.sap.adt.datapreview.table.v1+xml');
    res.end(adtXml(dataPreviewXml(name, '', rowNumber)));
    return;
  }
  if (path === '/datapreview/freestyle') {
    const sql = url.searchParams.get('sqlQuery') ?? url.searchParams.get('sql') ?? 'SELECT';
    const rowNumber = Number(url.searchParams.get('rowNumber') ?? 2) || 2;
    res.setHeader('Content-Type', 'application/vnd.sap.adt.datapreview.table.v1+xml');
    res.end(adtXml(dataPreviewXml('QUERY', sql, rowNumber)));
    return;
  }

  // ---- Runtime dumps (ST22 short-dump analysis) ----
  if (path === '/runtime/dumps' && req.method === 'GET') {
    let dumps: MockDump[] = [...DUMPS];
    const query = url.searchParams.get('$query') ?? '';
    const userMatch = /equals\(\s*user\s*,\s*([^)\s]+)\s*\)/.exec(query);
    if (userMatch) dumps = dumps.filter((d) => d.user.toUpperCase() === userMatch[1]!.toUpperCase());
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from) dumps = dumps.filter((d) => d.id.slice(0, from.length) >= from);
    if (to) dumps = dumps.filter((d) => d.id.slice(0, to.length) <= to);
    const top = Number(url.searchParams.get('$top') ?? 0);
    const skip = Number(url.searchParams.get('$skip') ?? 0);
    if (skip > 0) dumps = dumps.slice(skip);
    if (top > 0) dumps = dumps.slice(0, top);
    res.setHeader('Content-Type', 'application/atom+xml;type=feed');
    const entries = dumps
      .map(
        (d) => `  <entry>
    <id>${d.id}</id>
    <title>${d.title}</title>
    <category term="${d.category}"/>
    <updated>${d.updatedAt}</updated>
    <author><name>${d.user}</name></author>
    <link href="/sap/bc/adt/runtime/dump/${d.id}" rel="self"/>
  </entry>`,
      )
      .join('\n');
    res.end(
      `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <title>Runtime Dumps</title>\n${entries}\n</feed>`,
    );
    return;
  }
  const dumpMatch = /^\/runtime\/dump\/([^/]+?)(?:\/(summary|formatted))?$/.exec(path);
  if (dumpMatch && req.method === 'GET') {
    const dump = DUMPS.find((d) => d.id === decodeURIComponent(dumpMatch[1]!));
    if (!dump) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/xml');
      res.end(errorXml(`Runtime dump ${dumpMatch[1]} does not exist`));
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
    res.end(
      adtXml(
        `<dump:dump xmlns:dump="http://www.sap.com/adt/runtime/dumps" type="${dump.title}" id="${dump.id}">
  <dump:category>${dump.category}</dump:category>
  <dump:happenedAt>${dump.updatedAt}</dump:happenedAt>
  <dump:program>${dump.program}</dump:program>
  <dump:user>${dump.user}</dump:user>
  <dump:errorAnalysis>
    <dump:shortText>${xmlEscape(dump.text)}</dump:shortText>
    <dump:errorType>${dump.title}</dump:errorType>
  </dump:errorAnalysis>
</dump:dump>`,
      ),
    );
    return;
  }

  // ---- Program / class execution ----
  const programRun = /^\/programs\/programrun\/([^/]+)$/.exec(path);
  if (programRun && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    const name = decodeURIComponent(programRun[1]!).toUpperCase();
    const obj = findObjectByName(state, name);
    if (!obj || obj.category !== 'PROG') {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/xml');
      res.end(errorXml(`Program ${name} does not exist`));
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`${name} executed (mock run)\nHello, World!\nOutput lines: 2`);
    return;
  }
  const classRun = /^\/oo\/classrun\/([^/]+)$/.exec(path);
  if (classRun && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    const name = decodeURIComponent(classRun[1]!).toUpperCase();
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
    const writes = [...obj.source.matchAll(/out->write\(\s*'([^']*)'/g)].map((m) => m[1]!);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(writes.join('\n'));
    return;
  }

  // ---- Protocol-level $batch (multipart embedded HTTP requests) ----
  if (path === '/$batch' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    const body = await readBody(req);
    const boundaryMatch = /boundary=([^;\s]+)/.exec(req.headers['content-type'] ?? '');
    const boundary = boundaryMatch?.[1] ?? 'batch';
    const innerResponses: string[] = [];
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
      const method = requestMatch[1]!;
      const innerPath = requestMatch[2]!;
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
      innerResponses.push(
        `Content-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\nHTTP/1.1 ${stub.statusCode} ${stub.statusText}\r\n${headerLines}\r\n\r\n${stub.body}`,
      );
    }
    const responseBoundary = `response_${randomUUID()}`;
    res.setHeader('Content-Type', `multipart/mixed; boundary=${responseBoundary}`);
    res.end(
      innerResponses.map((r) => `--${responseBoundary}\r\n${r}`).join('\r\n') + `\r\n--${responseBoundary}--\r\n`,
    );
    return;
  }

  // ---- Structured metadata editors (MSAG / DOMA / DTEL / TTYP) ----
  const structuredObj = findObject(state, path);
  const structured = structuredKindFor(structuredObj, req.headers.accept ?? '', req.method);
  if (structuredObj && structured) {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', STRUCTURED_MEDIA[structured].split(',')[0]!.trim());
      res.end(structuredObj.metadataXml ?? defaultMetadataXml(structuredObj));
      return;
    }
    if (req.method === 'PUT') {
      if (!checkCsrf(req, res, state)) return;
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
      if (corrNr) structuredObj.corrNr = corrNr.toUpperCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/xml');
      res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}"/>`));
      return;
    }
  }

  // ---- Object version history (Atom feed) ----
  if (path.endsWith('/source/main/versions') && req.method === 'GET') {
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
    return;
  }

  // ---- Node structure (package content) ----
  if (path === '/repository/nodestructure') {
    const parentName = (url.searchParams.get('parent_name') ?? '').toUpperCase();
    const parentType = url.searchParams.get('parent_type') ?? '';
    res.setHeader('Content-Type', 'application/vnd.sap.adt.repository.nodestructure.v1+xml');
    if (parentType === 'DEVC/K' || parentName === 'DEVC/K') {
      const members = state.objects
        .filter((o) => o.packageName === parentName)
        .map(
          (o) =>
            `<repo:node repo:name="${o.name}" repo:type="${o.type}" repo:description="${xmlEscape(o.description)}" repo:uri="${o.uri}"/>`,
        )
        .join('\n  ');
      res.end(
        adtXml(
          `<repo:nodeStructure xmlns:repo="http://www.sap.com/adt/repository" parent_name="${parentName}" parent_type="DEVC/K">
  ${members}
</repo:nodeStructure>`,
        ),
      );
      return;
    }
    res.end(adtXml(`<repo:nodeStructure xmlns:repo="http://www.sap.com/adt/repository"/>`));
    return;
  }

  // ---- Transports ----
  if (path === '/cts/transportrequests') {
    res.setHeader('Content-Type', 'application/vnd.sap.adt.transportorganizertree.v1+xml');
    res.end(
      adtXml(
        `<trs:transportRequests xmlns:trs="http://www.sap.com/adt/cts">
  <trs:request trs:number="S4HK900001" trs:description="Demo request 1" trs:status="M" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000"/>
  <trs:request trs:number="S4HK900002" trs:description="Demo request 2 (released)" trs:status="R" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000" trs:target="QAS"/>
</trs:transportRequests>`,
      ),
    );
    return;
  }
  const transportMatch = /^\/cts\/transportrequests\/([^/]+)(?:\/(release))?$/.exec(path);
  if (transportMatch) {
    const number = decodeURIComponent(transportMatch[1]!);
    const action = transportMatch[2];
    if (action === 'release') {
      if (!checkCsrf(req, res, state)) return;
      res.setHeader('Content-Type', 'application/vnd.sap.adt.transportorganizer.v1+xml');
      res.end(
        adtXml(
          `<trs:request xmlns:trs="http://www.sap.com/adt/cts" trs:number="${number}" trs:description="Released by mock" trs:status="R" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000" trs:target="QAS"/>`,
        ),
      );
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.sap.adt.transportorganizer.v1+xml');
    const items = state.objects
      .slice(0, 3)
      .map(
        (o) =>
          `<trs:item trs:uri="${o.uri}" trs:type="${o.type}" trs:name="${o.name}" trs:description="${xmlEscape(o.description)}" trs:action="I"/>`,
      )
      .join('\n  ');
    res.end(
      adtXml(
        `<trs:request xmlns:trs="http://www.sap.com/adt/cts" trs:number="${number}" trs:description="Demo request" trs:status="${number.endsWith('002') ? 'R' : 'M'}" trs:type="K" trs:user="DEMO" trs:system="${opts.systemId}" trs:client="000">
  ${items}
</trs:request>`,
      ),
    );
    return;
  }

  // ---- Object creation (type-specific collections) ----
  const createMatch = /^\/(oo\/classes|oo\/interfaces|programs\/programs|ddls\/sources|ddic\/tables|ddic\/structures|ddic\/domains|ddic\/dataelements|ddic\/tabletypes|msgclass|packages)$/.exec(path);
  if (createMatch && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
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
    const name = nameMatch[1]!.toUpperCase();
    const type = typeForCollection(createMatch[1]!);
    const category = type.split('/')[0]!;
    if (findObjectByName(state, name)) {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/xml');
      res.end(errorXml(`Object ${name} already exists`));
      return;
    }
    const obj: MockObject = {
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
    state.objects.push(obj);
    res.statusCode = 201;
    res.setHeader('Location', obj.uri);
    res.setHeader('Content-Type', 'application/xml');
    res.end(objectRefXml(obj));
    return;
  }

  // ---- Lock / unlock (_action=LOCK / _action=UNLOCK) ----
  const action = url.searchParams.get('_action');
  const lockHandleParam = url.searchParams.get('lockHandle');
  const objByUri = findObject(state, path);
  if (objByUri && action === 'LOCK' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    // Like the real backend: an object already belonging to an open request
    // keeps it (its corrNr is returned); only a fresh transportable object
    // gets a NEW auto-created task.
    const corrnr = objByUri.corrNr ?? `MOCKK${String(900000 + Math.floor(Math.random() * 99999))}`;
    const handle = randomUUID();
    const user = parseBasicAuth(req)?.username?.toUpperCase() ?? 'DEMO';
    state.locked.set(objByUri.uri, { handle, corrnr, user });
    res.setHeader('X-ADT-Lock-Handle', handle);
    res.setHeader('Content-Type', 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result');
    res.end(lockResultXml(handle, corrnr));
    return;
  }
  if (objByUri && action === 'UNLOCK' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    state.locked.delete(objByUri.uri);
    void lockHandleParam;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result');
    res.end(lockResultXml('', ''));
    return;
  }

  // ---- Object delete (_action=DELETE) ----
  if (objByUri && action === 'DELETE' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    state.objects = state.objects.filter((o) => o.uri !== objByUri.uri);
    state.locked.delete(objByUri.uri);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}"/>`));
    return;
  }

  // ---- Object read / write (base URI or /source/main) ----
  const sourcePath = path.endsWith('/source/main') ? path.slice(0, -'/source/main'.length) : path;
  const srcObj = findObject(state, sourcePath);
  if (srcObj) {
    if (req.method === 'GET') {
      if (path.endsWith('/source/main')) {
        const version = url.searchParams.get('version');
        // `version=active` reads the last-activated snapshot; plain reads
        // return the current (saved, possibly inactive) source; historical
        // version ids return a deterministic prefixed variant.
        const source =
          version === 'active'
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
      return;
    }
    if (req.method === 'PUT' && path.endsWith('/source/main')) {
      if (!checkCsrf(req, res, state)) return;
      const body = await readBody(req);
      const codeMatch = /<[a-z]+:code[^>]*>([\s\S]*?)<\/[a-z]+:code>/.exec(body);
      const source = codeMatch ? unescapeXml(codeMatch[1]!) : body;
      srcObj.source = source;
      srcObj.changedAt = new Date().toISOString();
      srcObj.changedBy = 'DEMO';
      // The corrNr of the PUT is the request the change is recorded into —
      // remember it so the next lock reuses it (object joins that open task).
      const corrNr = url.searchParams.get('corrNr');
      if (corrNr) srcObj.corrNr = corrNr.toUpperCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/xml');
      res.end(adtXml(`<adtcore:objectReferences xmlns:adtcore="${NS_ADT}"/>`));
      return;
    }
  }

  // ---- Activation ----
  if (path === '/repository/activation' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    const body = await readBody(req);
    const method = url.searchParams.get('method') ?? 'activate';
    const refs = [...body.matchAll(/adtcore:uri="([^"]+)"[^>]*adtcore:name="([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const);
    const items = refs.map(([uri, name]) => {
      const obj = findObject(state, uri) ?? findObjectByName(state, name);
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
      if (method !== 'check') obj.activeSource = obj.source;
      return `<adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}" adtcore:status="${method === 'check' ? 'CHECKED' : 'ACTIVATED'}"/>`;
    });
    const hasError = refs.some(([uri, name]) => {
      const obj = findObject(state, uri) ?? findObjectByName(state, name);
      return obj?.source.includes('ZBROKEN') || !obj;
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml');
    const messages = hasError
      ? `<chkl:messages xmlns:chkl="${NS_CHKL}"><chkl:msg type="E"><chkl:shortText><chkl:txt>Activation failed for one or more objects</chkl:txt></chkl:shortText></chkl:msg></chkl:messages>`
      : '';
    res.end(
      adtXml(
        `<adtcore:objectReferences xmlns:adtcore="${NS_ADT}">
  ${items.join('\n  ')}
</adtcore:objectReferences>${messages}`,
      ),
    );
    return;
  }

  // ---- Check run ----
  if (path === '/checkruns' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    const body = await readBody(req);
    const refs = [...body.matchAll(/adtcore:uri="([^"]+)"/g)].map((m) => m[1]!);
    const msgs: string[] = [];
    for (const uri of refs) {
      const obj = findObject(state, uri);
      if (obj?.source.includes('ZBROKEN')) {
        msgs.push(
          `<chkl:msg type="E"><chkl:shortText><chkl:txt>Syntax error: ZBROKEN is not defined (${obj.name})</chkl:txt></chkl:shortText></chkl:msg>`,
        );
      }
    }
    res.setHeader('Content-Type', 'application/vnd.sap.adt.checkmessages+xml');
    res.end(
      adtXml(
        `<chkl:messages xmlns:chkl="${NS_CHKL}">
  ${msgs.join('\n  ')}
</chkl:messages>`,
      ),
    );
    return;
  }

  // ---- ABAP Unit (async run) ----
  if (path === '/abapunit/runs' && req.method === 'POST') {
    if (opts.legacyUnitOnly) {
      // Old backends (BASIS < 7.5x) never registered the async run service.
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/xml');
      res.end(errorXml('Resource not found: /abapunit/runs (legacy backend; use /abapunit/testruns)'));
      return;
    }
    if (!checkCsrf(req, res, state)) return;
    const body = await readBody(req);
    const requestedNames = [...body.matchAll(/osl:object name="([^"]+)"/g)].map((m) => m[1]!.toUpperCase());
    const runId = randomUUID();
    state.unitRuns.set(runId, requestedNames.length ? requestedNames : undefined);
    res.statusCode = 201;
    res.setHeader('Location', `/sap/bc/adt/abapunit/runs/${runId}`);
    res.setHeader('Content-Type', 'application/vnd.sap.adt.api.abapunit.run-status.v1+xml');
    res.end(
      adtXml(
        `<aunit:runStatus xmlns:aunit="${NS_AUNIT}" xmlns:atom="http://www.w3.org/2005/Atom" status="completed" completed="true">
  <aunit:id>${runId}</aunit:id>
  <atom:link rel="self" href="/sap/bc/adt/abapunit/runs/${runId}"/>
  <atom:link rel="result" href="/sap/bc/adt/abapunit/results/${runId}"/>
</aunit:runStatus>`,
      ),
    );
    return;
  }
  const unitStatusMatch = /^\/abapunit\/runs\/([^/]+)$/.exec(path);
  if (unitStatusMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/vnd.sap.adt.api.abapunit.run-status.v1+xml');
    res.end(
      adtXml(
        `<aunit:runStatus xmlns:aunit="${NS_AUNIT}" xmlns:atom="http://www.w3.org/2005/Atom" status="completed" completed="true">
  <aunit:id>${unitStatusMatch[1]}</aunit:id>
  <atom:link rel="result" href="/sap/bc/adt/abapunit/results/${unitStatusMatch[1]}"/>
</aunit:runStatus>`,
      ),
    );
    return;
  }
  const unitResultMatch = /^\/abapunit\/results\/([^/]+)$/.exec(path);
  if (unitResultMatch && req.method === 'GET') {
    const runId = unitResultMatch[1]!;
    const requested = state.unitRuns.get(runId);
    res.setHeader('Content-Type', 'application/vnd.sap.adt.api.junit.run-result.v1+xml');
    const testCases: string[] = [];
    let passed = 0;
    let failed = 0;
    let total = 0;
    const targets = requested
      ? state.objects.filter((o) => requested.includes(o.name.toUpperCase()))
      : state.objects.filter((o) => o.unit);
    for (const obj of targets) {
      if (!obj.unit) continue;
      if (obj.unit.failed > 0) {
        total += obj.unit.total;
        failed += obj.unit.failed;
        for (let i = 0; i < obj.unit.total; i++) {
          const name = obj.unit.failedMethod ?? `TEST_${i + 1}`;
          testCases.push(
            `<testcase asserts="1" time="0.01" name="${name}" classname="${obj.name.toLowerCase()}">
      <failure type="Assert Failure" message="${xmlEscape(obj.unit.failedMessage ?? '')}">expected: &lt;X&gt; but was: &lt;Y&gt;</failure>
    </testcase>`,
          );
        }
      } else {
        total += obj.unit.total;
        passed += obj.unit.total;
        for (let i = 0; i < obj.unit.total; i++) {
          testCases.push(`<testcase asserts="1" time="0.01" name="TEST_${i + 1}" classname="${obj.name.toLowerCase()}"/>`);
        }
      }
    }
    res.end(
      adtXml(
        `<testsuites tests="${total}" asserts="${total}" skipped="0" errors="0" failures="${failed}" timestamp="2026-08-13T12:00:00Z" time="0.36" executedBy="DEMO" client="000" system="${opts.systemId}">
  <testsuite tests="${total}" asserts="${total}" skipped="0" errors="0" failures="${failed}" name="">
    ${testCases.join('\n    ')}
  </testsuite>
</testsuites>`,
      ),
    );
    return;
  }

  // ---- ABAP Unit (legacy synchronous testruns; BASIS < 7.5x) ----
  if (path === '/abapunit/testruns' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    const body = await readBody(req);
    const uris = [...body.matchAll(/adtcore:uri="([^"]+)"/g)].map((m) => m[1]!);
    const targets = uris
      .map((u) => findObject(state, u))
      .filter((o): o is MockObject => Boolean(o?.unit));
    // Legacy backends execute the run synchronously and answer with
    // aunit:runResult (ns http://www.sap.com/adt/aunit) — programs →
    // testClasses → testMethods, alerts carrying severity/title/text.
    const programs = targets.map((obj) => {
      const methods: string[] = [];
      for (let i = 0; i < obj.unit!.total; i++) {
        const isFailed = i < obj.unit!.failed;
        const name = isFailed ? obj.unit!.failedMethod ?? `TEST_${i + 1}` : `TEST_${i + 1}`;
        const alert = isFailed
          ? `\n        <aunit:alert kind="assert" severity="critical" title="Assertion failed">${xmlEscape(obj.unit!.failedMessage ?? 'expected: <X> but was: <Y>')}</aunit:alert>`
          : '';
        methods.push(
          `<aunit:testMethod name="${name}" duration="0.01" unit="seconds">${alert}
        </aunit:testMethod>`,
        );
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
    res.end(
      adtXml(
        `<aunit:runResult xmlns:aunit="${NS_AUNIT_LEGACY}">
  ${programs.join('\n  ')}
</aunit:runResult>`,
      ),
    );
    return;
  }

  // ---- ATC (async run) ----
  if (path === '/atc/runs' && req.method === 'POST') {
    if (!checkCsrf(req, res, state)) return;
    const runId = randomUUID();
    state.atcRunIds.add(runId);
    state.atcRunIds.add(`A${runId.slice(1)}`.toUpperCase());
    res.statusCode = 201;
    res.setHeader('Location', `/sap/bc/adt/atc/runs/${runId}`);
    res.setHeader('Content-Type', 'application/vnd.sap.atc.run.v1+xml');
    res.end(
      adtXml(
        `<atc:run xmlns:atc="${NS_ATC}" xmlns:atom="http://www.w3.org/2005/Atom" state="completed">
  <atc:id>${runId}</atc:id>
  <atc:displayId>${runId}</atc:displayId>
  <atom:link rel="result" href="/sap/bc/adt/atc/results/${runId}"/>
</atc:run>`,
      ),
    );
    return;
  }
  const atcStatusMatch = /^\/atc\/runs\/([^/]+)$/.exec(path);
  if (atcStatusMatch && req.method === 'GET') {
    // Mirror the real backend shape: `status` attribute, phases, and a result
    // link whose id DIFFERS from the run id (exercises link extraction).
    const runId = atcStatusMatch[1]!;
    const resultId = `A${runId.slice(1)}`.toUpperCase();
    res.setHeader('Content-Type', 'application/vnd.sap.atc.run.v1+xml');
    res.end(
      adtXml(
        `<atc:run xmlns:atc="${NS_ATC}" xmlns:atom="http://www.w3.org/2005/Atom" status="Completed">
  <atc:id>${runId}</atc:id>
  <atc:progress description="Run Completed"/>
  <atc:phases>
    <atc:phase title="Determine Object Keys" status="Completed" number="1"/>
    <atc:phase title="Check Objects" status="Completed" number="2"/>
    <atc:phase title="Completion Phase" status="Completed" number="3"/>
  </atc:phases>
  <atom:link href="/sap/bc/adt/atc/results/${resultId}" rel="http://www.sap.com/abap/checks/atc/relations/result"/>
</atc:run>`,
      ),
    );
    return;
  }
  // ---- ATC results collection (list existing runs) ----
  if (path === '/atc/results' && req.method === 'GET') {
    const createdBy = (url.searchParams.get('createdBy') ?? 'DEMO').toUpperCase();
    res.setHeader('Content-Type', 'application/xml');
    const runs = ATC_SAMPLE_RUNS.filter((r) => !createdBy || r.createdBy.toUpperCase() === createdBy || createdBy === '*')
      .map(
        (r) =>
          `<atcresult:result displayId="${r.displayId}" createdBy="${r.createdBy}" createdAt="${r.createdAt}" status="COMPLETED"/>`,
      )
      .join('\n  ');
    res.end(
      adtXml(
        `<atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result">
  ${runs}
</atcresult:resultList>`,
      ),
    );
    return;
  }
  const atcResultMatch = /^\/atc\/results\/([^/]+)$/.exec(path);
  if (atcResultMatch && req.method === 'GET') {
    const displayId = atcResultMatch[1]!.toUpperCase();
    const sample = ATC_SAMPLE_RUNS.find((r) => r.displayId.toUpperCase() === displayId);
    const fromAsyncRun = state.atcRunIds.has(atcResultMatch[1]!);
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
    // Real-backend shape: resultList → result → objects → object → findings.
    res.setHeader('Content-Type', 'application/xml');
    const objectsXml = targets
      .map((o) => {
        const findings = (o.atcFindings ?? [])
          .map((f, i) => {
            const priority = f.severity === 'CRITICAL' ? 1 : f.severity === 'ERROR' ? 2 : f.severity === 'WARNING' ? 3 : 4;
            return `<atcfinding:finding adtcore:uri="/sap/bc/adt/atc/findings/itemid/${displayId}/index/${i + 1}" atcfinding:location="/sap/bc/adt/oo/classes/${o.name.toLowerCase()}/source/main#start=${f.line ?? 1},0" atcfinding:priority="${priority}" atcfinding:checkId="${f.check}" atcfinding:checkTitle="${xmlEscape(f.checkTitle)}" atcfinding:messageId="${f.check}" atcfinding:messageTitle="${xmlEscape(f.message)}" xmlns:atcfinding="http://www.sap.com/adt/atc/finding" xmlns:adtcore="http://www.sap.com/adt/core"/>`;
          })
          .join('\n      ');
        return `<atcobject:object adtcore:uri="/sap/bc/adt/oo/classes/${o.name.toLowerCase()}/source/main" adtcore:type="${o.category}" adtcore:name="${o.name}" adtcore:packageName="${o.packageName}" atcobject:author="DEMO" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:adtcore="http://www.sap.com/adt/core">
      <atcobject:findings>${findings}</atcobject:findings>
    </atcobject:object>`;
      })
      .join('\n  ');
    const counts = { p1: 0, p2: 0, p3: 0, p4: 0 };
    for (const o of targets) {
      for (const f of o.atcFindings ?? []) {
        if (f.severity === 'CRITICAL') counts.p1++;
        else if (f.severity === 'ERROR') counts.p2++;
        else if (f.severity === 'WARNING') counts.p3++;
        else counts.p4++;
      }
    }
    res.end(
      adtXml(
        `<atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result" xmlns:adtcore="http://www.sap.com/adt/core">
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
</atcresult:resultList>`,
      ),
    );
    return;
  }

  // ---- 404 ----
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/xml');
  res.end(errorXml(`Mock ADT: no handler for ${req.method} ${path}`));
}

// --- Structured metadata editors (MSAG / DOMA / DTEL / TTYP) -----------------

/** Media types of the structured kinds (mirrors @nefevcore/abap-adt-protocol). */
const STRUCTURED_MEDIA: Record<'MSAG' | 'DOMA' | 'DTEL' | 'TTYP', string> = {
  MSAG: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml',
  DOMA: 'application/vnd.sap.adt.domains.v2+xml',
  DTEL: 'application/vnd.sap.adt.dataelements.v2+xml',
  TTYP: 'application/vnd.sap.adt.tabletypes.v2+xml',
};

/** Does this request negotiate a structured editor representation? */
function structuredKindFor(
  obj: MockObject | undefined,
  accept: string | undefined,
  method: string | undefined,
): 'MSAG' | 'DOMA' | 'DTEL' | 'TTYP' | undefined {
  if (!obj || accept === undefined || (method !== 'GET' && method !== 'PUT')) return undefined;
  const category = obj.category as 'MSAG' | 'DOMA' | 'DTEL' | 'TTYP';
  if (!(category in STRUCTURED_MEDIA)) return undefined;
  const media = STRUCTURED_MEDIA[category];
  const marker = media.split(',')[0]!.trim().split('.')[0]!; // e.g. 'application/vnd'
  // Match when the Accept header carries the kind-specific media type (or a
  // wildcard that the generic object handler would not claim more strongly).
  const acceptsStructured = media
    .split(',')
    .some((m) => accept.includes(m.trim()))
    || (category === 'MSAG' && accept.includes('mc.messageclass'));
  if (acceptsStructured) return category;
  // A bare `application/xml` GET is ambiguous — the generic handler serves it.
  void marker;
  return undefined;
}

/** Minimal structured skeleton for objects created without metadata XML. */
function defaultMetadataXml(obj: MockObject): string {
  const head =
    ` adtcore:name="${obj.name}" adtcore:type="${obj.type}" adtcore:description="${xmlEscape(obj.description)}"` +
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

const HTTP_STATUS_TEXT: Record<number, string> = {
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
async function dispatchInner(
  outer: IncomingMessage,
  state: MockState,
  opts: Ctx,
  method: string,
  pathWithQuery: string,
  body: string | undefined,
  accept: string | undefined,
): Promise<{ statusCode: number; statusText: string; headers: Record<string, string>; body: string }> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(outer.headers)) {
    if (typeof value !== 'string') continue;
    if (['content-type', 'content-length', 'host', 'connection'].includes(key)) continue;
    headers[key] = value;
  }
  if (accept) headers.accept = accept;
  let statusCode = 200;
  let responseBody = '';
  const stubReq = {
    method,
    url: pathWithQuery,
    headers,
    async *[Symbol.asyncIterator](): AsyncGenerator<Buffer> {
      if (body !== undefined && body.length > 0) yield Buffer.from(body, 'utf8');
    },
  };
  const outHeaders: Record<string, string> = {};
  const stubRes = {
    get statusCode(): number {
      return statusCode;
    },
    set statusCode(value: number) {
      statusCode = value;
    },
    setHeader(key: string, value: string | number): void {
      outHeaders[String(key).toLowerCase()] = String(value);
    },
    getHeader(key: string): string | undefined {
      return outHeaders[String(key).toLowerCase()];
    },
    removeHeader(key: string): void {
      delete outHeaders[String(key).toLowerCase()];
    },
    end(chunk?: string | Buffer): void {
      if (chunk !== undefined) responseBody = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    },
  };
  await handle(
    stubReq as unknown as IncomingMessage,
    stubRes as unknown as ServerResponse,
    state,
    opts,
  );
  const emitted: Record<string, string> = {};
  for (const [key, value] of Object.entries(outHeaders)) {
    if (key.startsWith('access-control-') || key === 'content-length' || key === 'set-cookie') continue;
    emitted[key] = value;
  }
  return { statusCode, statusText: HTTP_STATUS_TEXT[statusCode] ?? '', headers: emitted, body: responseBody };
}

function typeForCollection(collection: string): string {  switch (collection) {
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
      return 'MSAG/N';
    case 'packages':
      return 'DEVC/K';
    default:
      return 'CLAS/OC';
  }
}

function unescapeXml(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** Build a case-insensitive matcher honoring `*` wildcards (like ADT search). */
function wildcardMatcher(query: string): (value: string) => boolean {
  const lower = query.toLowerCase();
  if (!lower.includes('*')) return (value) => value.toLowerCase().includes(lower);
  const escaped = lower.split('*').map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('.*');
  const re = new RegExp(`^${escaped}$`);
  return (value) => re.test(value.toLowerCase());
}

function uriFor(type: string, name: string): string {
  const cat = type.split('/')[0]!;
  switch (cat) {
    case 'CLAS':
      return `/sap/bc/adt/oo/classes/${name.toLowerCase()}`;
    case 'INTF':
      return `/sap/bc/adt/oo/interfaces/${name.toLowerCase()}`;
    case 'PROG':
      return `/sap/bc/adt/programs/programs/${name.toLowerCase()}`;
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

function initialSourceFor(type: string, name: string): string {
  const cat = type.split('/')[0]!;
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
