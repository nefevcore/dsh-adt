/**
 * Build a single-file distribution of the dsh plugin.
 *
 * Output: dist/dsh-plugin-abap-adt.bundle.mjs — a self-contained ESM module
 * (plugin + ADT protocol client + mock server inlined; @deepseek-ai/* peers
 * resolved from the host profile). Recipients can point their profile's
 * cordis.patch.yml `name` at this file — no monorepo or build needed.
 *
 * Usage:  node scripts/bundle.mjs
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'dist');
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [join(root, 'packages/dsh-plugin-abap-adt/src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: join(outdir, 'dsh-plugin-abap-adt.bundle.mjs'),
  // Peer services come from the host dsh profile — never bundle them.
  external: ['@deepseek-ai/*'],
  banner: {
    js: `/* dsh-abap-adt — ABAP Development Tools plugin for DeepSeek Harness
   Built from packages/dsh-plugin-abap-adt. MIT. See README.md for usage. */`,
  },
  logLevel: 'info',
  sourcemap: false,
});

console.log('Bundle written to dist/dsh-plugin-abap-adt.bundle.mjs');
