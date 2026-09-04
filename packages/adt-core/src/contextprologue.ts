/**
 * Context prologue — vsp `pkg/ctxcomp` idea, adapted to this plugin's
 * primitives: when an agent reads an ABAP object it usually needs the PUBLIC
 * CONTRACTS of what that object uses, not just its own source. This module
 * extracts dependency candidates from the read slice (see abap.ts), fetches
 * their contracts with a bounded parallel budget, and renders an ABAP-comment
 * prologue.
 *
 * Budget discipline (the part worth copying verbatim from vsp): the budget is
 * spent on contracts that ARRIVE — a candidate that fails to resolve costs
 * one fetch attempt, not one slot — and every unresolved dependency stays
 * visible in the answer, because a dependency the reader cannot see is still
 * a dependency.
 */
import type { AdtClient } from '@nefevcore/abap-adt-protocol';
import { extractContract, extractDependencyCandidates, rankDependencies, type DepCandidate } from './abap.js';

/** Default number of contracts to resolve into one prologue. */
export const DEFAULT_CONTEXT_DEPS = 8;
/** Clamp bounds for the `contextDeps` parameter. */
export const CONTEXT_DEPS_MIN = 1;
export const CONTEXT_DEPS_MAX = 15;
/** Whole-prologue character cap — a prologue must never outweigh the source. */
const PROLOGUE_MAX_CHARS = 24_000;
/** Parallel fetch width (independent of the budget — failures refill slots). */
const FETCH_WIDTH = 6;

export interface ContextPrologueStats {
  found: number;
  resolved: number;
  unresolved: number;
  /** Candidates beyond the budget that were never attempted. */
  deferred: number;
}

export interface ContextPrologueResult {
  prologue: string | undefined;
  stats: ContextPrologueStats;
}

interface ResolvedContract {
  name: string;
  uri: string;
  type: 'CLAS' | 'INTF';
  contract: string;
}

interface UnresolvedDep {
  name: string;
  reason: string;
}

/** One independent fetch attempt: exact-name search → type check → read. */
async function fetchContract(
  client: AdtClient,
  cand: DepCandidate,
  signal?: AbortSignal,
): Promise<{ ok: ResolvedContract } | { fail: UnresolvedDep }> {
  try {
    const hits = await client.searchObjects(cand.name, { maxResults: 5, signal });
    const exact = hits.find((h) => h.objectName.toUpperCase() === cand.name);
    if (!exact) {
      return { fail: { name: cand.name, reason: 'no exact object match on the backend' } };
    }
    const t = (exact.type ?? '').toUpperCase();
    if (t.startsWith('INTF')) {
      const src = await client.readSource(exact.uri, { signal });
      return { ok: { name: cand.name, uri: exact.uri, type: 'INTF', contract: extractContract(src.source, cand.name, 'INTF') } };
    }
    if (t.startsWith('CLAS')) {
      const src = await client.readSource(exact.uri, { signal });
      return { ok: { name: cand.name, uri: exact.uri, type: 'CLAS', contract: extractContract(src.source, cand.name, 'CLAS') } };
    }
    return { fail: { name: cand.name, reason: `resolved to ${exact.type || 'an unsupported type'} — only class/interface contracts are fetched` } };
  } catch (error) {
    return { fail: { name: cand.name, reason: `read failed: ${(error as Error).message}` } };
  }
}

/**
 * Build the dependency-contract prologue for one read slice.
 *
 * @param slice the source text the agent will see (a method block when the
 *        read is method-level — dependencies scope to the method then).
 */
export async function buildContextPrologue(
  client: AdtClient,
  slice: string,
  selfName: string,
  options: { maxDeps?: number; signal?: AbortSignal } = {},
): Promise<ContextPrologueResult> {
  const maxDeps = Math.min(Math.max(Math.floor(options.maxDeps ?? DEFAULT_CONTEXT_DEPS), CONTEXT_DEPS_MIN), CONTEXT_DEPS_MAX);

  const candidates = extractDependencyCandidates(slice, selfName);
  const ranked = rankDependencies(candidates.filter((c) => c.kind === 'oo'));
  const functions = candidates.filter((c) => c.kind === 'function');

  const pool = ranked.slice(0, maxDeps * 2); // failures refill from the pool
  const deferred = Math.max(ranked.length - pool.length, 0);

  const resolved: ResolvedContract[] = [];
  const unresolved: UnresolvedDep[] = [];
  let offset = 0;
  while (resolved.length < maxDeps && offset < pool.length) {
    const want = Math.min((maxDeps - resolved.length) * 2, FETCH_WIDTH, pool.length - offset);
    const batch = pool.slice(offset, offset + want);
    offset += batch.length;
    // Parallel within the batch; each outcome either fills a slot or stays
    // visible as an unresolved dependency.
    const outcomes = await Promise.all(batch.map((c) => fetchContract(client, c, options.signal)));
    for (const o of outcomes) {
      if ('ok' in o && resolved.length < maxDeps) resolved.push(o.ok);
      else if ('ok' in o) unresolved.push({ name: o.ok.name, reason: 'beyond the contextDeps budget' });
      else unresolved.push(o.fail);
    }
  }

  if (resolved.length === 0 && unresolved.length === 0 && functions.length === 0) {
    return { prologue: undefined, stats: { found: candidates.length, resolved: 0, unresolved: 0, deferred } };
  }

  const lines: string[] = [];
  lines.push(
    `"* ═══ dependency context: ${candidates.length} candidate(s) · ${resolved.length} resolved · ` +
      `${unresolved.length} unresolved${deferred > 0 ? ` · ${deferred} deferred (raise contextDeps)` : ''}`,
  );
  let usedChars = lines[0]!.length;
  for (const r of resolved) {
    const header = `"* ── ${r.name} · ${r.type === 'INTF' ? 'interface (full contract)' : 'class (public section only)'} — ${r.uri}`;
    const block = [header, r.contract].join('\n');
    if (usedChars + block.length > PROLOGUE_MAX_CHARS) {
      lines.push(`"* ── ${r.name} · elided: prologue character budget reached (raise contextDeps / read it directly)`);
      continue;
    }
    usedChars += block.length;
    lines.push(block);
  }
  // Unresolved deps stay visible — a partial context must not read as whole.
  for (const u of unresolved) {
    lines.push(`"* ── ${u.name} · UNRESOLVED: ${u.reason} — still a dependency; read it with adt_read_object if it matters`);
  }
  if (functions.length > 0) {
    const calls = functions.map((f) => `${f.name} (${f.usageCount}×)`).join(', ');
    lines.push(`"* function modules called: ${calls} — contracts live in the function group (adt_read_object, type FUGR)`);
  }
  return {
    prologue: lines.join('\n\n'),
    stats: { found: candidates.length, resolved: resolved.length, unresolved: unresolved.length, deferred },
  };
}
