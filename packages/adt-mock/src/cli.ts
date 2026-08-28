import { createMockAdtServer } from './server.js';

const port = Number(process.env.ADT_MOCK_PORT ?? 8123);
// CORS is ON by default so a local page can drive the demo; set
// ADT_MOCK_CORS=0 to serve without permissive CORS headers (see
// MockAdtOptions.cors for the security note).
const server = createMockAdtServer({
  port,
  host: process.env.ADT_MOCK_HOST ?? '127.0.0.1',
  username: process.env.ADT_MOCK_USER,
  password: process.env.ADT_MOCK_PASSWORD,
  cors: process.env.ADT_MOCK_CORS !== '0',
});

try {
  const actualPort = await server.listen();
  console.log(`Mock ADT server listening on http://127.0.0.1:${actualPort}/sap/bc/adt`);
  console.log(`Base URL for the plugin destination: http://127.0.0.1:${actualPort}`);
  console.log('Press Ctrl+C to stop.');
} catch (error) {
  // A busy port used to crash with a raw EADDRINUSE stack (audit P3) —
  // answer with the remedy instead.
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use — pass ADT_MOCK_PORT=<free port> and retry.`);
    process.exit(1);
  }
  throw error;
}

process.on('SIGINT', async () => {
  await server.close().catch(() => undefined);
  process.exit(0);
});
