import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  adtUrlsFor,
  discoverSapGuiLandscape,
  searchSapGuiConnections,
  splitServer,
  sysnrFromDiagPort,
} from '../lib/sapgui.js';

/** Fixture modelled on a real SAPUILandscape.xml (SAP GUI 7.50+/8.x). */
const MAIN_XML = `<?xml version="1.0"?>
<Landscape updated="2026-08-31T00:53:39Z" version="1" generator="SAP GUI for Windows v8000.1.11.155">
\t<Workspaces>
\t\t<Workspace uuid="w1" name="Project" expanded="1">
\t\t\t<Node uuid="n1" name="[120] IMPC">
\t\t\t\t<Item uuid="i1" serviceid="svc-direct"/>
\t\t\t\t<Item uuid="i2" serviceid="svc-ref"/>
\t\t\t\t<Item uuid="i3" serviceid="svc-group"/>
\t\t\t</Node>
\t\t\t<Node uuid="n2" name="[130] Other"><Item uuid="i4" serviceid="svc-routed"/></Node>
\t\t</Workspace>
\t</Workspaces>
\t<Routers>
\t\t<Router uuid="r1" name="/H/1.2.3.4" description="/H/1.2.3.4" router="/H/1.2.3.4"/>
\t</Routers>
\t<Services>
\t\t<Service type="SAPGUI" uuid="svc-direct" name="IMPC S4 DEV" systemid="D01" mode="1" server="10.126.22.123:3201" sncop="-1" dcpg="2"/>
\t\t<Service type="SAPGUI" uuid="svc-routed" name="Routed SYS" systemid="R01" mode="1" server="10.0.0.9:3200" routerid="r1" sncop="-1" dcpg="2"/>
\t\t<Service type="Reference" shortcut="1" reuse="1" uuid="svc-ref" name="IMPC S4 DEV 100" description="IMPC S4 DEV" systemid="D01" client="100" user="DEVUSER" language="ZH" link="svc-direct"/>
\t\t<Service type="SAPGUI" uuid="svc-group" name="GLP PRD" systemid="S4P" msid="ms1" server="PUBLIC" sncop="-1" dcpg="2"/>
\t</Services>
\t<Includes>
\t\t<Include url="{INCLUDE_URL}" index="0"/>
\t</Includes>
\t<Messageservers>
\t\t<Messageserver uuid="ms1" name="S4P" host="ms.example.com" port="3600"/>
\t</Messageservers>
</Landscape>
`;

const INCLUDE_XML = `<?xml version="1.0"?>
<Landscape version="1">
\t<Services>
\t\t<Service type="SAPGUI" uuid="svc-include" name="Included QAS" systemid="Q01" mode="1" server="10.5.5.5:3210" sncop="-1" dcpg="2"/>
\t</Services>
</Landscape>
`;

/** Classic saplogon.ini fallback fixture ([System] comma items). */
const CLASSIC_INI = `[Configuration]
Codepage=1100

[EntryKey]
Item1=

[System]
Item1=Old PRD Box,PRD,,,10.9.9.9:3299,00,,
Item2=Broken entry,,,,,,
`;

function withLandscapeEnv<T>(paths: string[], fn: () => T): T {
  const previous = process.env.ADT_SAPGUI_LANDSCAPE;
  process.env.ADT_SAPGUI_LANDSCAPE = paths.join(';');
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.ADT_SAPGUI_LANDSCAPE;
    else process.env.ADT_SAPGUI_LANDSCAPE = previous;
  }
}

/** Write the fixture pair (main + include) into a temp dir; returns paths. */
function writeFixtures(): { main: string; include: string } {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-sapgui-'));
  const include = join(dir, 'SAPUILandscapeGlobal.xml');
  writeFileSync(include, INCLUDE_XML, 'utf8');
  const main = join(dir, 'SAPUILandscape.xml');
  const includeUrl = 'file:///' + include.replace(/\\/g, '/');
  writeFileSync(main, MAIN_XML.replace('{INCLUDE_URL}', includeUrl), 'utf8');
  return { main, include };
}

test('adtUrlsFor: port convention 443<nn> / 80<nn>; no sysnr -> bare host', () => {
  assert.deepEqual(adtUrlsFor('h.example.com', '01'), {
    adtUrl: 'https://h.example.com:44301',
    httpUrl: 'http://h.example.com:8001',
  });
  assert.deepEqual(adtUrlsFor('h.example.com', '00'), {
    adtUrl: 'https://h.example.com:44300',
    httpUrl: 'http://h.example.com:8000',
  });
  assert.deepEqual(adtUrlsFor('h.example.com', undefined), { adtUrl: 'https://h.example.com' });
});

test('server attribute parsing: host:port, bare host, bracketed IPv6', () => {
  assert.deepEqual(splitServer('10.0.0.1:3201'), { host: '10.0.0.1', port: 3201 });
  assert.deepEqual(splitServer('vhcalnplci'), { host: 'vhcalnplci' });
  assert.deepEqual(splitServer('[::1]:3200'), { host: '::1', port: 3200 });
  assert.equal(sysnrFromDiagPort(3201), '01');
  assert.equal(sysnrFromDiagPort(3200), '00');
  assert.equal(sysnrFromDiagPort(3299), '99');
  assert.equal(sysnrFromDiagPort(3600), undefined);
});

test('discoverSapGuiLandscape: direct, reference, group and include entries', () => {
  const { main, include } = writeFixtures();
  try {
    const landscape = withLandscapeEnv([main], () => discoverSapGuiLandscape());
    assert.deepEqual(landscape.sources, [main, include]);
    const by = new Map(landscape.connections.map((c) => [c.uuid, c]));

    const direct = by.get('svc-direct');
    assert.equal(direct?.kind, 'direct');
    assert.equal(direct?.systemId, 'D01');
    assert.equal(direct?.host, '10.126.22.123');
    assert.equal(direct?.sysnr, '01');
    assert.equal(direct?.adtUrl, 'https://10.126.22.123:44301');
    assert.equal(direct?.httpUrl, 'http://10.126.22.123:8001');
    assert.equal(direct?.folder, 'Project / [120] IMPC');

    // Reference resolves client/user/language and the parent's host/URL.
    const ref = by.get('svc-ref');
    assert.equal(ref?.kind, 'reference');
    assert.equal(ref?.client, '100');
    assert.equal(ref?.user, 'DEVUSER');
    assert.equal(ref?.language, 'ZH');
    assert.equal(ref?.adtUrl, 'https://10.126.22.123:44301');
    assert.equal(ref?.host, '10.126.22.123');

    // Group connection: message server resolved, no URL derivable.
    const group = by.get('svc-group');
    assert.equal(group?.kind, 'group');
    assert.equal(group?.groupName, 'PUBLIC');
    assert.equal(group?.msHost, 'ms.example.com');
    assert.equal(group?.adtUrl, undefined);
    assert.match(group?.adtUrlNote ?? '', /load-balancing/);

    // Router association via routerid.
    assert.equal(by.get('svc-routed')?.router, '/H/1.2.3.4');

    // Included landscape contributes with its own source path.
    const inc = by.get('svc-include');
    assert.equal(inc?.name, 'Included QAS');
    assert.equal(inc?.source, include);
    assert.equal(inc?.adtUrl, 'https://10.5.5.5:44310');
  } finally {
    rmSync(join(main, '..'), { recursive: true, force: true });
  }
});

test('searchSapGuiConnections: name/systemId/client matching, case-insensitive', () => {
  const { main } = writeFixtures();
  try {
    const landscape = withLandscapeEnv([main], () => discoverSapGuiLandscape());
    const names = (q?: string) => searchSapGuiConnections(landscape.connections, q).map((c) => c.name);
    assert.deepEqual(names('impc').sort(), ['GLP PRD', 'IMPC S4 DEV', 'IMPC S4 DEV 100']); // folder match counts
    assert.deepEqual(names('s4 dev').sort(), ['IMPC S4 DEV', 'IMPC S4 DEV 100']);
    assert.deepEqual(names('d01').sort(), ['IMPC S4 DEV', 'IMPC S4 DEV 100']);
    assert.deepEqual(names('100'), ['IMPC S4 DEV 100']);
    assert.deepEqual(names('DEVUSER'), ['IMPC S4 DEV 100']);
    assert.deepEqual(names('no-such-system'), []);
    assert.ok(names().length >= 5, 'empty query lists everything');
  } finally {
    rmSync(join(main, '..'), { recursive: true, force: true });
  }
});

test('discoverSapGuiLandscape: no landscape at all -> empty sources (degrades, never throws)', () => {
  const missing = join(tmpdir(), 'abap-adt-none', 'nowhere.xml');
  const landscape = withLandscapeEnv([missing], () => discoverSapGuiLandscape());
  assert.deepEqual(landscape.sources, []);
  assert.deepEqual(landscape.connections, []);
});

test('classic saplogon.ini fallback: only when no XML override is used', () => {
  // Point APPDATA at a temp Common dir holding only saplogon.ini.
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ini-'));
  const previousAppData = process.env.APPDATA;
  const previousLandscape = process.env.ADT_SAPGUI_LANDSCAPE;
  delete process.env.ADT_SAPGUI_LANDSCAPE;
  process.env.APPDATA = dir;
  try {
    mkdirSync(join(dir, 'SAP', 'Common'), { recursive: true });
    writeFileSync(join(dir, 'SAP', 'Common', 'saplogon.ini'), CLASSIC_INI, 'utf8');
    const landscape = discoverSapGuiLandscape();
    assert.deepEqual(landscape.sources, [join(dir, 'SAP', 'Common', 'saplogon.ini')]);
    const old = landscape.connections.find((c) => c.name === 'Old PRD Box');
    assert.equal(old?.host, '10.9.9.9');
    assert.equal(old?.sysnr, '99');
    assert.equal(old?.adtUrl, 'https://10.9.9.9:44399');
    assert.match(old?.adtUrlNote ?? '', /saplogon\.ini/);
    // The unparseable entry is skipped, not fatal.
    assert.equal(landscape.connections.length, 1);
  } finally {
    if (previousAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = previousAppData;
    if (previousLandscape === undefined) delete process.env.ADT_SAPGUI_LANDSCAPE;
    else process.env.ADT_SAPGUI_LANDSCAPE = previousLandscape;
    rmSync(dir, { recursive: true, force: true });
  }
});
