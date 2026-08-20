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
    // Bundled CJS deps (yaml, undici, …) keep real `require(...)` calls for
    // node builtins. In an ESM output there is no module-scope `require`, so
    // esbuild's `__require` shim would throw
    // `Dynamic require of "process" is not supported` the moment DSH imports
    // the bundle. Provide a real require via createRequire FIRST — the shim
    // checks `typeof require !== "undefined"` and uses it when present.
    js: `import { createRequire as __dshCreateRequire } from "node:module";
const require = __dshCreateRequire(import.meta.url);
/* dsh-abap-adt — ABAP Development Tools plugin for DeepSeek Harness
   Built from packages/dsh-plugin-abap-adt. MIT. See README.md for usage. */`,
  },
  logLevel: 'info',
  sourcemap: false,
});

console.log('Bundle written to dist/dsh-plugin-abap-adt.bundle.mjs');
