import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdtClient } from '../lib/index.js';

/**
 * Minimal fetch stand-in: serves canned ADT responses. GET-only is enough —
 * listTransports performs a single GET with no CSRF dance.
 */
function fakeFetch(bodyByPath: Record<string, string>) {
  return async (_url: string | URL, init?: RequestInit) => {
    const url = String(_url);
    const body = Object.entries(bodyByPath).find(([key]) => url.includes(key))?.[1];
    if (body === undefined) {
      return new Response('not found', { status: 404 });
    }
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/vnd.sap.adt.transportorganizertree.v1+xml; charset=utf-8',
      },
    });
  };
}

const destination = {
  name: 'test',
  url: 'https://sap.example.com:44300/',
  client: '110',
  language: 'ZH',
  auth: { type: 'basic' as const, username: 'ABAP04', password: 'pw' },
  strictSSL: false,
};

const TREE_XML = `<?xml version="1.0" encoding="utf-8"?>
<tm:root adtcore:name="ABAP04" xmlns:tm="http://www.sap.com/cts/adt/tm" xmlns:adtcore="http://www.sap.com/adt/core">
  <tm:workbench tm:category="工作台">
    <tm:modifiable tm:status="可修改">
      <tm:request tm:number="D01K966300" tm:parent="" tm:owner="ABAP04" tm:desc="Open demo request" tm:type="K" tm:status="M" tm:target="QAS"/>
      <tm:request tm:number="D01K966301" tm:parent="D01K966300" tm:owner="ABAP04" tm:desc="Task of the open request" tm:type="T" tm:status="M"/>
    </tm:modifiable>
    <tm:released tm:status="已发布 (From Last 2 Weeks)">
      <tm:request tm:number="D01K966255" tm:parent="" tm:owner="ABAP04" tm:desc="SHYY_PS038:清空预算_ABAP04_260813" tm:type="K" tm:status="R" tm:target="" tm:lastchanged_timestamp="20260813170122">
        <tm:long_desc/>
        <tm:abap_object tm:pgmid="CORR" tm:type="RELE" tm:name="D01K966256 20260813 170115 ABAP05"/>
      </tm:request>
    </tm:released>
  </tm:workbench>
  <tm:customizing tm:category="定制">
    <tm:released tm:status="已发布 (From Last 2 Weeks)">
      <tm:request tm:number="D01K966400" tm:parent="" tm:owner="ABAP04" tm:desc="Customizing request" tm:type="C" tm:status="R"/>
    </tm:released>
  </tm:customizing>
</tm:root>`;

test('listTransports parses a real Transport Organizer Tree (nested groups)', async () => {
  const client = new AdtClient(destination, fakeFetch({ '/cts/transportrequests': TREE_XML }));
  const transports = await client.listTransports();

  // Task elements (type T) are skipped; requests across all groups are found.
  assert.equal(transports.length, 3);
  const byNumber = new Map(transports.map((t) => [t.number, t]));

  const open = byNumber.get('D01K966300');
  assert.ok(open);
  assert.equal(open.status, 'M');
  assert.equal(open.category, 'K');
  assert.equal(open.owner, 'ABAP04');
  assert.equal(open.description, 'Open demo request');
  assert.equal(open.target, 'QAS');
  assert.equal(open.modifiable, true);

  const released = byNumber.get('D01K966255');
  assert.ok(released);
  assert.equal(released.status, 'R');
  assert.equal(released.modifiable, false);
  assert.equal(released.createdAt, '20260813170122');
  // Items inside a released request come from tm:abap_object elements.
  assert.equal(released.items.length, 1);
  assert.equal(released.items[0]!.name, 'D01K966256 20260813 170115 ABAP05');
  assert.equal(released.items[0]!.type, 'RELE');

  const customizing = byNumber.get('D01K966400');
  assert.ok(customizing);
  assert.equal(customizing.category, 'C');
});

test('listTransports status filter keeps only the requested release state', async () => {
  const client = new AdtClient(destination, fakeFetch({ '/cts/transportrequests': TREE_XML }));

  const modifiable = await client.listTransports({ status: 'modifiable' });
  assert.deepEqual(modifiable.map((t) => t.number), ['D01K966300']);
  assert.equal(modifiable[0]!.modifiable, true);

  const released = await client.listTransports({ status: 'released' });
  assert.deepEqual(released.map((t) => t.number).sort(), ['D01K966255', 'D01K966400']);
  assert.ok(released.every((t) => !t.modifiable));

  const all = await client.listTransports({ status: 'all' });
  assert.equal(all.length, 3);

  // Backend letter code 'D' is an alias for 'modifiable'.
  const byLetter = await client.listTransports({ status: 'D' });
  assert.deepEqual(byLetter.map((t) => t.number), ['D01K966300']);
});

test('listTransports still parses the flat shape (mock style)', async () => {
  const flat = `<trs:transportRequests xmlns:trs="http://www.sap.com/adt/cts">
  <trs:request trs:number="S4HK900001" trs:description="Demo request 1" trs:status="M" trs:type="K" trs:user="DEMO" trs:system="D01" trs:client="000"/>
</trs:transportRequests>`;
  const client = new AdtClient(destination, fakeFetch({ '/cts/transportrequests': flat }));
  const transports = await client.listTransports();
  assert.equal(transports.length, 1);
  assert.equal(transports[0]!.number, 'S4HK900001');
  assert.equal(transports[0]!.description, 'Demo request 1');
  assert.equal(transports[0]!.owner, 'DEMO');
  assert.equal(transports[0]!.system, 'D01');
  assert.equal(transports[0]!.client, '000');
  assert.equal(transports[0]!.modifiable, true);
});

// --- getTransport -----------------------------------------------------------

const REQUEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<tm:root tm:object_type="R" adtcore:name="D01K966175" adtcore:type="RQRQ" xmlns:tm="http://www.sap.com/cts/adt/tm" xmlns:adtcore="http://www.sap.com/adt/core">
  <tm:request tm:number="D01K966175" tm:parent="" tm:owner="ABAP04" tm:desc="AI_SD003:影像上传" tm:type="K" tm:status="D" tm:target="/IMPC/" tm:lastchanged_timestamp="20260806093331">
    <tm:all_objects>
      <tm:abap_object tm:pgmid="LIMU" tm:type="FUNC" tm:name="ZFM_DZH_ZPDF_WF" tm:obj_desc="转pdf工作流调用函数" tm:position="000001"/>
      <tm:abap_object tm:pgmid="R3TR" tm:type="PROG" tm:name="ZAI_FI_AUDIT_TEST" tm:obj_desc="AI审核流程测试程序" tm:position="000002"/>
    </tm:all_objects>
    <tm:task tm:number="D01K966176" tm:parent="D01K966175" tm:owner="ABAP04" tm:type="Development/Correction" tm:status="D">
      <tm:abap_object tm:pgmid="LIMU" tm:type="FUNC" tm:name="ZFM_DZH_ZPDF_WF" tm:obj_desc="转pdf工作流调用函数" tm:position="000001"/>
    </tm:task>
  </tm:request>
</tm:root>`;

test('getTransport parses the wrapped real-backend shape (tm:root envelope)', async () => {
  const client = new AdtClient(destination, fakeFetch({ '/cts/transportrequests/D01K966175': REQUEST_XML }));
  const t = await client.getTransport('D01K966175');
  assert.equal(t.number, 'D01K966175');
  assert.equal(t.status, 'D');
  assert.equal(t.modifiable, true);
  assert.equal(t.owner, 'ABAP04');
  assert.equal(t.category, 'K');
  assert.equal(t.target, '/IMPC/');
  assert.equal(t.description, 'AI_SD003:影像上传');
  assert.equal(t.createdAt, '20260806093331');
  // Items come from the request's all_objects block; the task's repeated
  // objects are not duplicated.
  assert.equal(t.items.length, 2);
  assert.equal(t.items[0]!.name, 'ZFM_DZH_ZPDF_WF');
  assert.equal(t.items[0]!.type, 'FUNC');
  assert.equal(t.items[0]!.description, '转pdf工作流调用函数');
  assert.equal(t.items[1]!.name, 'ZAI_FI_AUDIT_TEST');
});

test('getTransport parses the flat mock shape (request as root)', async () => {
  const flat = `<trs:request xmlns:trs="http://www.sap.com/adt/cts" trs:number="S4HK900001" trs:description="Demo request" trs:status="M" trs:type="K" trs:user="DEMO" trs:system="D01" trs:client="000">
  <trs:item trs:uri="/x" trs:type="PROG" trs:name="ZTEST" trs:description="Test" trs:action="I"/>
</trs:request>`;
  const client = new AdtClient(destination, fakeFetch({ '/cts/transportrequests/S4HK900001': flat }));
  const t = await client.getTransport('S4HK900001');
  assert.equal(t.number, 'S4HK900001');
  assert.equal(t.status, 'M');
  assert.equal(t.modifiable, true);
  assert.equal(t.owner, 'DEMO');
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0]!.name, 'ZTEST');
});

// --- getVersions ------------------------------------------------------------

const VERSIONS_FEED = `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core">
  <atom:title>Version List of ZAI_FI_AUDIT_TEST</atom:title>
  <atom:entry>
    <atom:author><atom:name>ABAP04</atom:name></atom:author>
    <atom:content type="text/plain" src="/sap/bc/adt/programs/programs/zai_fi_audit_test/source/main/versions/1/00000/content"/>
    <atom:id>00000</atom:id>
    <atom:link adtcore:name="D01K966176" href="/sap/bc/adt/cts/transportrequests/D01K966176" rel="http://www.sap.com/adt/relations/transport/request" type="application/vnd.sap.adt.transportrequests.v1+xml" title="AI_SD003:影像上传"/>
    <atom:title>AI_SD003:影像上传</atom:title>
    <atom:updated>2026-08-11T06:43:08Z</atom:updated>
  </atom:entry>
  <atom:entry>
    <atom:author><atom:name>ABAP05</atom:name></atom:author>
    <atom:content type="text/plain" src="/sap/bc/adt/programs/programs/zai_fi_audit_test/source/main/versions/2/00000/content"/>
    <atom:id>00001</atom:id>
    <atom:link adtcore:name="D01K960530" href="/sap/bc/adt/cts/transportrequests/D01K960530" rel="http://www.sap.com/adt/relations/transport/request" type="application/vnd.sap.adt.transportrequests.v1+xml" title="SHYY_PM:工厂对应利润中心取值逻辑调整"/>
    <atom:title>SHYY_PM:工厂对应利润中心取值逻辑调整</atom:title>
    <atom:updated>2025-07-31T21:46:19Z</atom:updated>
  </atom:entry>
</atom:feed>`;

test('getVersions parses the Atom feed with transport links', async () => {
  const client = new AdtClient(destination, fakeFetch({ '/source/main/versions': VERSIONS_FEED }));
  const versions = await client.getVersions('/sap/bc/adt/programs/programs/zai_fi_audit_test');
  assert.equal(versions.length, 2);
  const [latest, older] = versions;
  assert.equal(latest!.versionId, '00000');
  assert.equal(latest!.author, 'ABAP04');
  assert.equal(latest!.updatedAt, '2026-08-11T06:43:08Z');
  assert.equal(latest!.transportRequest, 'D01K966176');
  assert.equal(latest!.transportDescription, 'AI_SD003:影像上传');
  assert.equal(older!.transportRequest, 'D01K960530');
  assert.equal(older!.author, 'ABAP05');
});
