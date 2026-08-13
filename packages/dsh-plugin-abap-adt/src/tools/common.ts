import type { AdtObjectRef } from '@abap-adt/protocol';
import type { AdtRegistry } from '../registry.js';

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
  registry: AdtRegistry;
}

/** Render a simple text block. */
export function text(content: string): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: content }];
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
