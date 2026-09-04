import { defineTool } from '../tooldef.js';
import { sessionCwd, text, type ToolDeps } from './common.js';

/**
 * Read-only introspection tool for the ADT permission policy. Lets the agent
 * learn its own guard rails before attempting mutating work, instead of
 * discovering them one denial at a time. Reports the global defaults AND the
 * effective policy per destination (a destination-level `policy:` block
 * overrides the global keys for that system only).
 */
export function policyTools(deps: ToolDeps) {
  const { registry } = deps;

  return [
    defineTool({
      name: 'adt_permissions',
      description:
        'Show the effective ADT permission policy: whether transports are enabled, which transport request ' +
        'numbers are allowed, whether edits of transportable (non-$TMP) packages are permitted, which ' +
        'development packages may be edited, whether program/class execution is allowed, whether write ' +
        'parts inside adt_batch are allowed, whether the ABAP debugger family (adt_debug_*) and debugger ' +
        'variable writes are allowed, the destination environment profile (dev/qa/prd — prd ' +
        'hard-denies execution, batch writes and the debugger), and the read-side governance of ' +
        'adt_data_preview (blockedTablesProfile tiers off/minimal/standard/strict, custom blockedTables, ' +
        'allowedTables exemptions) — as GLOBAL defaults plus the effective values per destination (a destination ' +
        '`policy:` block overrides the globals for that system). ' +
        'Read this before any mutating adt_* call to know what will be denied.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,

          properties: {
            enableTransports: { type: 'boolean', required: true },
            allowedTransports: {
              type: 'array',
              required: true,
              items: { type: 'string' },
            },
            allowTransportableEdits: { type: 'boolean', required: true },
            allowedPackages: {
              type: 'array',
              required: true,
              items: { type: 'string' },
            },
            allowExecution: { type: 'boolean', required: true },
            allowBatchWrites: { type: 'boolean', required: true },
            allowDebugger: { type: 'boolean', required: true },
            allowDebugVariables: { type: 'boolean', required: true },
            profile: { type: 'string', required: true, description: 'Destination environment profile of the global defaults (dev unless set per destination).' },
            blockedTablesProfile: { type: 'string', required: true, description: 'Read-side governance tier for adt_data_preview row reads (off|minimal|standard|strict).' },
            blockedTables: {
              type: 'array',
              required: true,
              items: { type: 'string' },
              description: 'Custom blocked names/patterns on top of the built-in catalog.',
            },
            allowedTables: {
              type: 'array',
              required: true,
              items: { type: 'string' },
              description: 'Exemptions from the blocked-table catalog (audited on every use).',
            },
            sources: {
              type: 'object',
              required: true,
              additionalProperties: true,
            },
            defaults: {
              type: 'object',
              required: true,
              additionalProperties: true,
            },
            perDestination: {
              type: 'object',
              required: true,
              description: 'Effective policy per destination name (empty when no overrides exist).',
              additionalProperties: true,
            },
          },
        },
        render: (_args, value) => {
          const src = (key: string) => value.sources[key] ?? 'default';
          const lines = [
            'ADT permission policy — global defaults',
            '',
            `- enableTransports:        ${value.enableTransports} (source: ${src('enableTransports')})`,
            `- allowedTransports:       ${value.allowedTransports.join(', ') || '(none)'} (source: ${src('allowedTransports')})`,
            `- allowTransportableEdits: ${value.allowTransportableEdits} (source: ${src('allowTransportableEdits')})`,
            `- allowedPackages:         ${value.allowedPackages.join(', ') || '(none)'} (source: ${src('allowedPackages')})`,
            `- allowExecution:          ${value.allowExecution} (source: ${src('allowExecution')})`,
            `- allowBatchWrites:        ${value.allowBatchWrites} (source: ${src('allowBatchWrites')})`,
            `- allowDebugger:           ${value.allowDebugger} (source: ${src('allowDebugger')}) — adt_debug_* family`,
            `- allowDebugVariables:     ${value.allowDebugVariables} (source: ${src('allowDebugVariables')}) — changing debuggee values`,
            `- profile:                 ${value.profile} (qa: execution/batchWrites default off; prd: hard-denied)`,
            `- blockedTablesProfile:    ${value.blockedTablesProfile} (source: ${src('blockedTablesProfile')}) — read-side governance of adt_data_preview`,
            ...(value.blockedTables.length > 0
              ? [`- blockedTables:           ${value.blockedTables.join(', ')} (custom additions, always denied)`]
              : []),
            ...(value.allowedTables.length > 0
              ? [`- allowedTables:           ${value.allowedTables.join(', ')} (exemptions, audited)`]
              : []),
          ];
          const entries = Object.entries(value.perDestination ?? {});
          if (entries.length > 0) {
            lines.push('', 'Per destination (effective values):');
            for (const [name, raw] of entries) {
              const p = raw as {
                enableTransports: boolean;
                allowedTransports: string[];
                allowTransportableEdits: boolean;
                allowedPackages: string[];
                allowExecution?: boolean;
                allowBatchWrites?: boolean;
                profile?: string;
                blockedTablesProfile?: string;
              };
              lines.push(
                `- ${name}: transports=${p.enableTransports}, allowed=${p.allowedTransports.join(',') || '*'}, ` +
                  `transportableEdits=${p.allowTransportableEdits}, packages=${p.allowedPackages.join(',') || '*'}` +
                  (p.allowExecution !== undefined ? `, execution=${p.allowExecution}` : '') +
                  (p.allowBatchWrites !== undefined ? `, batchWrites=${p.allowBatchWrites}` : '') +
                  (p.profile && p.profile !== 'dev' ? `, profile=${p.profile}` : '') +
                  (p.blockedTablesProfile && p.blockedTablesProfile !== 'off'
                    ? `, blockedTables=${p.blockedTablesProfile}`
                    : ''),
              );
            }
          }
          lines.push(
            '',
            'Denials are raised as [POLICY] errors naming the rule. Sources: config (per destination > global) > SAP_* env > default.',
          );
          return text(lines.join('\n'));
        },
      },
      isConcurrencySafe: () => true,
      // Read via the registry so a settings hot reload is reflected immediately.
      execute: async (_args, exec) => {
        const { global, perDestination } = await registry.describePolicies(sessionCwd(exec));
        return {
          enableTransports: global.enableTransports,
          allowedTransports: global.allowedTransports,
          allowTransportableEdits: global.allowTransportableEdits,
          allowedPackages: global.allowedPackages,
          allowExecution: global.allowExecution,
          allowBatchWrites: global.allowBatchWrites,
          allowDebugger: global.allowDebugger,
          allowDebugVariables: global.allowDebugVariables,
          profile: global.profile,
          blockedTablesProfile: global.blockedTablesProfile,
          blockedTables: global.blockedTables,
          allowedTables: global.allowedTables,
          sources: global.sources,
          defaults: global.defaults,
          perDestination,
        };
      },
    }),
  ];
}
