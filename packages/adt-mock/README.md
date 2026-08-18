# @nefevcore/abap-adt-mock

In-memory mock of the SAP **ADT REST service** — exercise the ADT protocol client end-to-end without a real ABAP system.

Implements the practical subset of `/sap/bc/adt`: discovery (AtomPub), object search, source read/write with the lock protocol, activation with in-body messages, check runs, **ABAP Unit** (async run API *and* the legacy synchronous `testruns` service for old-BASIS simulation via `legacyUnitOnly`), ATC, transports, package contents, object creation and data preview. Behaviors mirror the real protocol: Basic auth, session cookies, CSRF enforcement on state-changing requests, correct `application/vnd.sap.*` media types.

## Install

```bash
npm install @nefevcore/abap-adt-mock
```

## Usage

```ts
import { createMockAdtServer } from '@nefevcore/abap-adt-mock';
import { AdtClient } from '@nefevcore/abap-adt-protocol';

const server = createMockAdtServer({ port: 0, username: 'demo', password: 'demo' });
const port = await server.listen();

const client = new AdtClient({
  name: 'test',
  url: `http://127.0.0.1:${port}`,
  client: '000',
  auth: { type: 'basic', username: 'demo', password: 'demo' },
});

const result = await client.runUnitTests([
  { uri: '/sap/bc/adt/oo/classes/zcl_demo', type: 'CLAS/OC', name: 'ZCL_DEMO' },
]);
// → { success: true, total: 2, passed: 2, ... }

await server.close();
```

Stand up a demo server on the CLI:

```bash
npx @nefevcore/abap-adt-mock
```

Companion packages:

- [`@nefevcore/abap-adt-protocol`](https://www.npmjs.com/package/@nefevcore/abap-adt-protocol) — the real-protocol client this mock verifies
- [`@nefevcore/abap-adt-dsh-plugin`](https://www.npmjs.com/package/@nefevcore/abap-adt-dsh-plugin) — uses this mock as its built-in `demo` destination

License: MIT
