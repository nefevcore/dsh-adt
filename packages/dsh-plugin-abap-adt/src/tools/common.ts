import type { AdtObjectRef } from '@nefevcore/abap-adt-protocol';
import type { AdtRegistry } from '../registry.js';
import type { LockLedger } from '../locks.js';

/** Parameter spec for the destination selector used by every tool. */
export const DESTINATION_PARAM = {
  destination: {
    type: 'string',
    description:
      'Destination name (configured in the plugin config). Omit to use the default destination.',
  },
} as const;

/** Pull the destination param value out of raw args. */
export function destinationOf(args: Record<string, unknown>): string | undefined {
  const value = args['destination'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Register-time helper: name a tool and give it the registry. */
export interface ToolDeps {
  /**
   * Destination registry. Read `registry.policy` at call time (NOT
   * destructured away): settings hot reload swaps the policy in place and a
   * captured reference would keep asserting against the stale one.
   */
  registry: AdtRegistry;
  /** Persistent lock ledger (see src/locks.ts). */
  ledger: LockLedger;
}

/** Render a simple text block. */
export function text(content: string): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: content }];
}

/**
 * Deep-strip `undefined` values so tool outputs pass the DSH lossless-JSON
 * boundary (the registry rejects any object property whose value is
 * `undefined`, because JSON has no representation for it). `null` is kept.
 */
export function deepCompact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const cleaned = deepCompact(item);
      if (cleaned !== undefined) out.push(cleaned);
    }
    return out;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = deepCompact(item);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

/** Render an object list as a compact table. */
export function renderObjectRefs(refs: AdtObjectRef[]): string {
  if (refs.length === 0) return '(no objects)';
  const rows = refs.map((r) => `- ${r.name} (${r.type}) — ${r.uri}`);
  return rows.join('\n');
}

/** A terse success renderer shared by lifecycle tools. */
export function renderMessages(title: string, lines: string[]): string {
  const body = lines.length ? lines.join('\n') : '(no messages)';
  return `${title}\n${body}`;
}
