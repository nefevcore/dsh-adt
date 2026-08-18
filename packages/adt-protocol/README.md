# @nefevcore/abap-adt-protocol

Pure-TypeScript client for the SAP **ABAP Development Tools (ADT) REST protocol** (`/sap/bc/adt`) — no SAP libraries, no VS Code / Eclipse required.

Covers the full development loop an automation client needs: authentication (Basic), session cookies, CSRF token management, object search, source read/write with lock protocol, activation (modern + legacy compatibility paths), syntax check, **ABAP Unit** (async run API + automatic fallback to the legacy synchronous `/abapunit/testruns` service on BASIS < 7.5x), **ATC** (with variant support), transports (CTO), package contents, data preview, where-used, version history and object creation.

## Install

```bash
npm install @nefevcore/abap-adt-protocol
```

## Usage

```ts
import { AdtClient } from '@nefevcore/abap-adt-protocol';

const client = new AdtClient({
  name: 'dev',
  url: 'https://my-sap-host:44300/',
  client: '100',
  language: 'EN',
  auth: { type: 'basic', username: 'DEVUSER', password: process.env.PASSWORD! },
  strictSSL: false, // self-signed certificate
});

// Search objects (use a * wildcard — many backends match exact tokens only)
const hits = await client.searchObjects('ZCL_FI_*');

// Read / edit / check / activate
const src = await client.readSource(hits[0]!.uri);
const check = await client.check([{ uri: hits[0]!.uri, type: hits[0]!.type, name: hits[0]!.objectName }]);
const activation = await client.activate([{ uri: hits[0]!.uri, type: hits[0]!.type, name: hits[0]!.objectName }]);

// ABAP Unit + ATC (legacy old-BASIS backends are handled automatically)
const unit = await client.runUnitTests([{ uri: hits[0]!.uri, type: hits[0]!.type, name: hits[0]!.objectName }]);
const atc = await client.runAtc([{ uri: hits[0]!.uri, type: hits[0]!.type, name: hits[0]!.objectName }], { variant: 'DEFAULT' });
```

Companion packages:

- [`@nefevcore/abap-adt-mock`](https://www.npmjs.com/package/@nefevcore/abap-adt-mock) — in-memory ADT server for tests/demos
- [`@nefevcore/abap-adt-dsh-plugin`](https://www.npmjs.com/package/@nefevcore/abap-adt-dsh-plugin) — agent tools built on this client

License: MIT
