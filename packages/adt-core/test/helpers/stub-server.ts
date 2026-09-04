/**
 * Local ADT stub server for tests: answers every request with `status`
 * (401 = the expected unauthenticated ADT reply) on a free port of the SAP
 * plain-HTTP convention range (80<nn>), so it appears among the probed
 * candidates of sysnr nn = port - 8000.
 */
import { createServer, type Server } from 'node:http';

export async function startAdtStubServer(status: number): Promise<{ server: Server; port: number }> {
  for (let port = 8099; port >= 8001; port--) {
    const server = createServer((_req, res) => {
      res.writeHead(status, { 'www-authenticate': 'Basic realm="SAP"' });
      res.end();
    });
    const listening = await new Promise<boolean>((resolve) => {
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => resolve(true));
    });
    if (listening) return { server, port };
  }
  throw new Error('no free port in the 80xx convention range');
}
