import { createMockAdtServer } from './server.js';

const port = Number(process.env.ADT_MOCK_PORT ?? 8123);
const server = createMockAdtServer({
  port,
  host: process.env.ADT_MOCK_HOST ?? '127.0.0.1',
  username: process.env.ADT_MOCK_USER,
  password: process.env.ADT_MOCK_PASSWORD,
});

const actualPort = await server.listen();
console.log(`Mock ADT server listening on http://127.0.0.1:${actualPort}/sap/bc/adt`);
console.log(`Base URL for the plugin destination: http://127.0.0.1:${actualPort}`);
console.log('Press Ctrl+C to stop.');

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});
