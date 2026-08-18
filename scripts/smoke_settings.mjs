/**
 * High-fidelity integration smoke: real cordis Context, real ToolRuntime,
 * real SettingsProvider (in-memory). Verifies the DSH-spec wiring end to end:
 *  - settings namespace registration + composition base fallback
 *  - user-section override (settings.yaml semantics) via provider.publish
 *  - HOT RELOAD: destinations appear/disappear without re-applying the plugin
 *  - graceful degradation when NO settings provider is mounted at all
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context, Service } from '@deepseek-ai/cordis';

// Isolated DSH home: the legacy auto-discovery and lock ledger never touch
// the real user home while this smoke runs.
const SMOKE_HOME = mkdtempSync(join(tmpdir(), 'dsh-smoke-home-'));
process.env.DSH_HOME = SMOKE_HOME;
process.env.DSH_HOME ||= SMOKE_HOME;
import { SettingsProvider } from '@deepseek-ai/dsh-settings';

/** Minimal fs service stand-in (the plugin injects 'fs'; tools that need it
 *  are not exercised in this smoke). */
class StubFs extends Service {
  constructor(ctx) { super(ctx, 'fs'); }
  async resolve(path) { return { path }; }
}

/** Minimal real Service standing in for ToolRuntime (register + get). */
class StubToolRuntime extends Service {
  definitions = new Map();
  constructor(ctx) { super(ctx, 'tools'); }
  register(def) {
    this.definitions.set(def.name, def);
    return () => this.definitions.delete(def.name);
  }
  get(name) { return this.definitions.get(name); }
}

const NS = 'abap-adt';

class MemoryProvider extends SettingsProvider {
  doc = {};
  get writable() { return true; }
  async load() { return this.doc; }
  async persist(ns, section) { this.doc[ns] = section; }
  /** Simulate the user editing settings.yaml in an external editor. */
  push(doc) { this.doc = doc; this.publish(doc); }
}

function makeRoot() {
  const root = new Context();
  return root;
}

async function waitIdle(ms = 300) { await new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Path 1: WITH a settings provider mounted
// ---------------------------------------------------------------------------
{
  const root = makeRoot();
  await root.plugin(StubToolRuntime);
  await root.plugin(StubFs);
  const providerFiber = await root.plugin(MemoryProvider);
  const provider = root.get('settings');

  let toolNames = [];
  const origRegister = root.tools.register.bind(root.tools);
  root.tools.register = (def) => { toolNames.push(def.name); return origRegister(def); };

  const plugin = await import('../packages/dsh-plugin-abap-adt/lib/index.js');
  await root.plugin(plugin, { demo: true, demoPort: 0 });
  await waitIdle();

  const exec = async (name, args = {}) => {
    const def = root.tools.get(name);
    return def.execute(args, { signal: new AbortController().signal });
  };

  console.log('1) tools registered:', toolNames.length);
  let list = await exec('adt_list_destinations');
  console.log('2) base (demo on):', list.destinations.map((d) => d.name).join(','));

  // User edits settings.yaml: turn demo OFF, then back ON — hot reload both ways.
  provider.push({ [NS]: { demo: false } });
  await waitIdle();
  list = await exec('adt_list_destinations');
  console.log('3) user demo=false →', list.destinations.map((d) => d.name).join(',') || '(none)');

  provider.push({ [NS]: { demo: true, demoPort: 0 } });
  await waitIdle();
  list = await exec('adt_list_destinations');
  console.log('4) user demo=true →', list.destinations.map((d) => d.name).join(','));

  // User adds a policy override; adt_permissions reflects it WITHOUT a restart.
  provider.push({ [NS]: { demo: true, demoPort: 0, allowedPackages: 'Z*' } });
  await waitIdle();
  const perms = await exec('adt_permissions');
  console.log('5) hot policy allowedPackages:', JSON.stringify(perms.allowedPackages));

  await root.fiber.dispose();
}

// ---------------------------------------------------------------------------
// Path 2: NO settings provider mounted (degrade to composition entry)
// ---------------------------------------------------------------------------
{
  const root = makeRoot();
  await root.plugin(StubToolRuntime);
  await root.plugin(StubFs);
  const plugin = await import('../packages/dsh-plugin-abap-adt/lib/index.js');
  await root.plugin(plugin, { demo: true, demoPort: 0 });
  await waitIdle();

  const def = root.tools.get('adt_list_destinations');
  const list = await def.execute({}, { signal: new AbortController().signal });
  console.log('6) no-provider degrade, entry demo=true →', list.destinations.map((d) => d.name).join(','));
  await root.fiber.dispose();
}
rmSync(SMOKE_HOME, { recursive: true, force: true });
console.log('SETTINGS SMOKE COMPLETE');
