import { AdtClient } from '@nefevcore/abap-adt-protocol';
import { createMockAdtServer } from '@nefevcore/abap-adt-mock';
const mock = createMockAdtServer({ port: 0, host: '127.0.0.1' });
const port = await mock.listen();
const mk = (timeoutMs) => new AdtClient({ name: 'm', url: `http://127.0.0.1:${port}`, client: '000', language: 'EN', auth: { type: 'basic', username: 'demo', password: 'demo' }, timeoutMs });
// mid-flight abort asserts message contains 'aborted'
{
  const ac = new AbortController();
  const c = mk(60_000);
  const p = c.search('zcl_demo', { signal: ac.signal }).then(() => 'OK', (e) => e.message);
  setTimeout(() => ac.abort(new Error('budget expired')), 5);
  console.log('mid-flight contains "aborted":', (await p).includes('aborted'));
}
// timeout asserts message contains 'timed out' and not 'aborted'
{
  const c = mk(1);
  const msg = await c.search('zcl_demo').then(() => 'OK', (e) => e.message);
  console.log('timeout msg contains "timed out":', msg.includes('timed out'), '| contains "aborted":', msg.includes('aborted'));
}
await mock.close();
