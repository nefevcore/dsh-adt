/**
 * Sync the canonical preset declaration into the plugin package so the npm
 * tarball is self-sufficient: a creator-mode agent can fetch everything from
 * npm (plugin + its deps + the preset patch) with no repo checkout.
 *
 * Run by the plugin package's prepack hook; output is gitignored.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'presets', 'abap-dev', 'cordis.patch.yml');
const target = join(root, 'packages', 'dsh-plugin-abap-adt', 'preset', 'cordis.patch.yml');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`preset patch synced: presets/abap-dev/cordis.patch.yml -> packages/dsh-plugin-abap-adt/preset/cordis.patch.yml`);
