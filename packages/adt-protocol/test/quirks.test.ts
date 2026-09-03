import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdtClient } from '../lib/index.js';

/**
 * Backend-quirk regressions from real-world field use (on-prem subset profile
 * "impc-dev" / D01 / client 110):
 *
 *  - transport status filters must be translated to the backend letter codes
 *    ('modifiable' forwarded verbatim matched zero rows),
 *  - subset ATC-results services reject every filter parameter with 400 while
 *    serving the parameterless collection,
 *  - ATC result bodies may carry no <aggregates> node (P1–P4 must be derived
 *    from the finding priorities) and nest include findings under the main
 *    program name with include-local line numbers,
 *  - the system release hides behind alternative discovery feature keys.
 */

const destination = {
  name: 'test',
  url: 'https://sap.example.com:44300/',
  client: '110',
  language: 'ZH',
  auth: { type: 'basic' as const, username: 'ABAP04', password: 'pw' },
  strictSSL: false,
};

/** fetch stand-in that records every URL it serves. */
function recordingFetch(handler: (url: string) => Response) {
  const urls: string[] = [];
  const fn = async (_url: string | URL): Promise<Response> => {
    const url = String(_url);
    urls.push(url);
    return handler(url);
  };
  return { fetch: fn as unknown as typeof fetch, urls };
}

const xml = (body: string, type = 'application/xml') =>
  new Response(body, { status: 200, headers: { 'content-type': type } });

const notFound = () => new Response('not found', { status: 404 });

const TREE_XML = `<?xml version="1.0" encoding="utf-8"?>
<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" xmlns:adtcore="http://www.sap.com/adt/core">
  <tm:workbench>
    <tm:modifiable>
      <tm:request tm:number="D01K966363" tm:owner="ABAP04" tm:desc="Open request" tm:type="K" tm:status="D"/>
    </tm:modifiable>
    <tm:released>
      <tm:request tm:number="D01K966100" tm:owner="ABAP04" tm:desc="Released" tm:type="K" tm:status="R"/>
    </tm:released>
  </tm:workbench>
</tm:root>`;

test('listTransports translates semantic status words to backend letter codes', async () => {
  const { fetch, urls } = recordingFetch(() =>
    xml(TREE_XML, 'application/vnd.sap.adt.transportorganizertree.v1+xml'),
  );
  const client = new AdtClient(destination, fetch);

  const modifiable = await client.listTransports({ status: 'modifiable' });
  assert.deepEqual(modifiable.map((t) => t.number), ['D01K966363']);
  const last = urls.at(-1)!;
  assert.match(last, /status=D/, 'semantic word must be translated for the wire');
  assert.doesNotMatch(last, /status=modifiable/);

  const released = await client.listTransports({ status: 'released' });
  assert.deepEqual(released.map((t) => t.number), ['D01K966100']);
  assert.match(urls.at(-1)!, /status=R/);
});

test('listTransports retries without the status parameter when the backend 400s', async () => {
  const { fetch, urls } = recordingFetch((url) => {
    if (url.includes('status=')) return new Response('unsupported parameter', { status: 400 });
    return xml(TREE_XML, 'application/vnd.sap.adt.transportorganizertree.v1+xml');
  });
  const client = new AdtClient(destination, fetch);

  const modifiable = await client.listTransports({ status: 'modifiable' });
  // The 400 was retried unfiltered and the client-side filter still applies.
  assert.deepEqual(modifiable.map((t) => t.number), ['D01K966363']);
  assert.equal(urls.filter((u) => u.includes('status=')).length, 1, 'exactly one filtered attempt');
});

const ATC_LIST_XML = `<atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result">
  <atcresult:result displayId="ID123" createdBy="ABAP04" createdAt="2026-08-13T12:00:00Z" status="COMPLETED"/>
  <atcresult:result displayId="ID456" createdBy="ABAP05" createdAt="2026-08-12T12:00:00Z" status="COMPLETED"/>
</atcresult:resultList>`;

test('listAtcRuns falls back to a parameterless query when filters are rejected (400)', async () => {
  const { fetch, urls } = recordingFetch((url) => {
    // Subset backend: ANY filter parameter → 400; bare query → full list.
    if (/[?&](createdBy|ageMin|ageMax|centralResult|activeResult|sysId|contactPerson)=/.test(url)) {
      return new Response('filters not supported', { status: 400 });
    }
    return xml(ATC_LIST_XML);
  });
  const client = new AdtClient(destination, fetch);

  // The default (logged-on user) filter is sent first and rejected — the
  // retry must still return the runs.
  const runs = await client.listAtcRuns();
  assert.equal(runs.length, 2);
  assert.equal(runs[0]!.displayId, 'ID123');
  assert.equal(urls.filter((u) => u.includes('createdBy=')).length, 1, 'exactly one filtered attempt');

  // Explicit filters hit the same fallback.
  const filtered = await client.listAtcRuns({ createdBy: 'ABAP04', active: true });
  assert.equal(filtered.length, 2);
});

const ATC_RESULT_XML = `<?xml version="1.0" encoding="utf-8"?>
<atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcobject="http://www.sap.com/adt/atc/object" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
  <atcresult:result>
    <atcresult:displayId>ID123</atcresult:displayId>
    <atcresult:title>External Request 20260813120000</atcresult:title>
    <atcresult:checkVariant>DEFAULT</atcresult:checkVariant>
    <atcresult:objects>
      <atcobject:object adtcore:name="ZFIR_GXYH040" adtcore:type="PROG/P">
        <atcobject:findings>
          <atcfinding:finding atcfinding:location="/sap/bc/adt/programs/includes/zfir_gxyh040_top/source/main#start=12,0" atcfinding:priority="2" atcfinding:checkId="SLIN_VERS" atcfinding:checkTitle="Obsolete statement" atcfinding:messageTitle="Obsolete statement in include"/>
          <atcfinding:finding atcfinding:location="/sap/bc/adt/programs/programs/zfir_gxyh040/source/main#start=3,0" atcfinding:priority="3" atcfinding:checkId="CI_FAVORITE" atcfinding:checkTitle="Performance" atcfinding:messageTitle="SELECT in loop"/>
        </atcobject:findings>
      </atcobject:object>
    </atcresult:objects>
  </atcresult:result>
</atcresult:resultList>`;

test('getAtcResult derives P1–P4 aggregates and include locations from findings', async () => {
  const { fetch } = recordingFetch((url) => {
    if (url.includes('/atc/results/ID123')) return xml(ATC_RESULT_XML);
    return notFound();
  });
  const client = new AdtClient(destination, fetch);

  const result = await client.getAtcResult('ID123');
  assert.equal(result.clean, false);
  assert.equal(result.findings.length, 2);

  // Both findings hang on the MAIN program name (real backend behavior)…
  assert.ok(result.findings.every((f) => f.objectName === 'ZFIR_GXYH040'));
  // …while the location URI of the first points at the INCLUDE.
  const includeFinding = result.findings[0]!;
  assert.equal(includeFinding.locationUri, '/sap/bc/adt/programs/includes/zfir_gxyh040_top/source/main');
  assert.equal(includeFinding.line, 12);
  assert.equal(includeFinding.severity, 'ERROR');
  // The main-program finding maps to the main program URI.
  assert.equal(result.findings[1]!.locationUri, '/sap/bc/adt/programs/programs/zfir_gxyh040/source/main');
  assert.equal(result.findings[1]!.line, 3);

  // No <aggregates> node in the body → derived from the finding priorities.
  assert.equal(result.aggregates?.priority2, 1);
  assert.equal(result.aggregates?.priority3, 1);
  assert.equal(result.aggregates?.priority1, 0);
});

test('systemInfo falls back to alternative release feature keys', async () => {
  const discovery = `<?xml version="1.0" encoding="utf-8"?>
<service xmlns="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom">
  <workspace>
    <atom:title>D01</atom:title>
    <collection href="/sap/bc/adt/programs/programs">
      <atom:title>Programs</atom:title>
      <accept>application/xml</accept>
    </collection>
  </workspace>
  <feature id="SAP_BASIS_RELEASE">758</feature>
</service>`;
  const { fetch } = recordingFetch((url) => {
    if (url.includes('systeminformation')) return notFound(); // endpoint absent
    if (url.includes('discovery')) return xml(discovery, 'application/atomsvc+xml');
    return notFound();
  });
  const client = new AdtClient(destination, fetch);

  const info = await client.systemInfo();
  assert.equal(info.release, '758');
});

// --- CSRF lifecycle (P0-5 verification) --------------------------------------
//
// abap-mcp warms the CSRF token before the first tool request to dodge SAP's
// first-request 403. Our client resolves tokens lazily INSIDE request(): the
// probe runs (and its cookies are stored) before the first state-changing
// request is ever sent — so a naked write cannot leave the client. This test
// locks that ordering in; if someone "optimizes" the probe away, it fails.

test('first state-changing request is preceded by the CSRF token probe — no naked writes', async () => {
  const seen: Array<{ method: string; csrf: string | undefined; url: string }> = [];
  const fetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    seen.push({ method: init?.method ?? 'GET', csrf: headers['X-CSRF-Token'], url: String(url) });
    if (headers['X-CSRF-Token'] === 'fetch') {
      // The probe: discovery GET answered with the token + session cookie.
      return new Response('<service xmlns="http://www.w3.org/2007/app"/>', {
        status: 200,
        headers: { 'content-type': 'application/atomsvc+xml', 'x-csrf-token': 'TOKEN-1' },
      });
    }
    if (init?.method === 'PUT') return new Response('', { status: 200 });
    return xml('<service xmlns="http://www.w3.org/2007/app"/>', 'application/atomsvc+xml');
  };
  const client = new AdtClient(destination, fetch as unknown as typeof fetch);

  await client.writeSource('/sap/bc/adt/programs/programs/zfoo', 'REPORT zfoo.\n', {
    lockHandle: 'H1',
  });
  // Second write: the cached token is reused, no second probe.
  await client.writeSource('/sap/bc/adt/programs/programs/zfoo', 'REPORT zfoo.\nWRITE / 1.\n', {
    lockHandle: 'H2',
  });

  // The very first outbound request is the token probe (GET + fetch header)…
  assert.equal(seen[0]!.method, 'GET');
  assert.equal(seen[0]!.csrf, 'fetch');
  // …every state-changing request carries the issued token — none is naked…
  const writes = seen.filter((r) => r.method !== 'GET');
  assert.ok(writes.length >= 2, 'two writes happened');
  assert.ok(writes.every((r) => r.csrf === 'TOKEN-1'), 'all writes carry the token');
  // …and the probe ran exactly once for both writes (cached, not re-fetched).
  assert.equal(seen.filter((r) => r.csrf === 'fetch').length, 1);
});

test('an invalidated CSRF session is re-probed once and the write retried with the fresh token', async () => {
  let issued = 0;
  const seen: Array<{ method: string; csrf: string | undefined }> = [];
  const fetch = async (_url: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const method = init?.method ?? 'GET';
    seen.push({ method, csrf: headers['X-CSRF-Token'] });
    if (headers['X-CSRF-Token'] === 'fetch') {
      issued += 1;
      return new Response('<service/>', {
        status: 200,
        headers: { 'content-type': 'application/xml', 'x-csrf-token': `TOKEN-${issued}` },
      });
    }
    // TOKEN-1 has been invalidated server-side: the write answers 403 + hint.
    if (method === 'PUT' && headers['X-CSRF-Token'] === 'TOKEN-1') {
      return new Response('CSRF token invalid', { status: 403, headers: { 'x-csrf-token': 'Required' } });
    }
    if (method === 'PUT') return new Response('', { status: 200 });
    return xml('<service xmlns="http://www.w3.org/2007/app"/>');
  };
  const client = new AdtClient(destination, fetch as unknown as typeof fetch);

  await client.writeSource('/sap/bc/adt/programs/programs/zfoo', 'REPORT zfoo.\n', { lockHandle: 'H' });

  const writes = seen.filter((r) => r.method === 'PUT');
  assert.deepEqual(
    writes.map((w) => w.csrf),
    ['TOKEN-1', 'TOKEN-2'],
    'first attempt with the stale token, retry with the re-probed one',
  );
  assert.equal(issued, 2, 'the session reset triggered exactly one fresh probe');
});
