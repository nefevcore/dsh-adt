import { defineTool } from '../tooldef.js';
import { sessionCwd,
  ATC_AGGREGATES_SCHEMA,
  ATC_COUNTS_SCHEMA,
  ATC_FINDINGS_SCHEMA,
  atcAggregatesSuffix,
  atcFindingOutput,
  renderAtcFindings,
  DESTINATION_PARAM,
  destinationOf,
  text,
  type ToolDeps,
} from './common.js';

/**
 * ATC run-introspection tools: list existing ATC runs on the system and fetch
 * a single run's result — complements `adt_run_atc` (which starts new runs).
 */
export function atcRunTools(deps: ToolDeps) {
  const { registry } = deps;

  const listAtcRuns = defineTool({
    name: 'adt_list_atc_runs',
    description:
      'List existing ATC (ABAP Test Cockpit) runs stored on the system. Each run shows its display id, creator, ' +
      'timestamp, state and P1–P4 finding aggregates. Backend support varies: many systems require a filter ' +
      '(the logged-on user is sent by default), but subset implementations accept a PARAMETERLESS query only and ' +
      'reject every filter with HTTP 400 — rejected filters are automatically retried without parameters. When ' +
      'accurate P1–P4 counts matter, prefer this list over re-parsing a single result via adt_get_atc_result.',
    parameters: {
      createdBy: {
        type: 'string',
        description: 'Filter by the user who created the run (default: logged-on user). Ignored by subset backends.',
      },
      ageMin: {
        type: 'integer',
        description: 'Minimum age in days (only runs older than this). Ignored by subset backends.',
      },
      ageMax: {
        type: 'integer',
        description: 'Maximum age in days (only runs younger than this). Ignored by subset backends.',
      },
      central: {
        type: 'boolean',
        description: 'List central (system-wide) check results instead of local ones. Ignored by subset backends.',
      },
      active: {
        type: 'boolean',
        description: 'List active (local) check results. Ignored by subset backends.',
      },
      sysId: {
        type: 'string',
        description: 'Filter by system id (with central results). Ignored by subset backends.',
      },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          count: { type: 'integer', required: true },
          runs: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,

              properties: {
                displayId: { type: 'string', required: true },
                title: { type: 'string' },
                checkVariant: { type: 'string' },
                createdAt: { type: 'string' },
                createdBy: { type: 'string' },
                status: { type: 'string' },
                kind: { type: 'string' },
                aggregates: ATC_AGGREGATES_SCHEMA,
                attributes: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
      render: (_args, value) =>
        text(
          [
            `ATC runs: ${value.count}`,
            ...value.runs.map((r) => {
              const agg = r.aggregates
                ? ` — P1 ${r.aggregates.priority1}, P2 ${r.aggregates.priority2}, P3 ${r.aggregates.priority3}, P4 ${r.aggregates.priority4}`
                : '';
              return (
                `- ${r.displayId}${r.title ? ` "${r.title}"` : ''}${r.checkVariant ? ` [${r.checkVariant}]` : ''}` +
                `${r.status ? ` ${r.status}` : ''}${r.createdBy ? ` by ${r.createdBy}` : ''}` +
                `${r.createdAt ? ` at ${r.createdAt}` : ''}${agg}`
              );
            }),
          ].join('\n'),
        ),
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec) => {
      const entry = await registry.require(destinationOf(args), sessionCwd(exec));
      const runs = await entry.client.listAtcRuns({
        createdBy: typeof args.createdBy === 'string' && args.createdBy ? args.createdBy : undefined,
        ageMin: typeof args.ageMin === 'number' ? args.ageMin : undefined,
        ageMax: typeof args.ageMax === 'number' ? args.ageMax : undefined,
        central: args.central === true,
        active: args.active === true,
        sysId: typeof args.sysId === 'string' ? args.sysId : undefined,
        signal: exec.signal,
      });
      return {
        count: runs.length,
        runs: runs.map((r) => ({
          displayId: r.displayId,
          title: r.title,
          checkVariant: r.checkVariant,
          createdAt: r.createdAt,
          createdBy: r.createdBy,
          status: r.status,
          kind: r.kind,
          aggregates: r.aggregates,
          attributes: r.attributes,
        })),
      };
    },
  });

  const getAtcResult = defineTool({
    name: 'adt_get_atc_result',
    description:
      'Fetch one stored ATC (ABAP Test Cockpit) run result by its display id. Returns findings with severity, check ' +
      'and source position. Use adt_list_atc_runs to discover ids. POSITION MAPPING: backends often nest ALL findings ' +
      'of a program under the MAIN program name while `line` counts in the INCLUDE the finding really points at — ' +
      'check each finding\'s `uri` (the object the line belongs to) before jumping to a line in the main program. ' +
      'P1–P4 aggregates come from the result body when it carries them, otherwise they are derived from the finding ' +
      'priorities; adt_list_atc_runs remains the authoritative source for aggregates.',
    parameters: {
      displayId: {
        type: 'string',
        required: true,
        description: 'ATC result display id (from adt_list_atc_runs).',
      },
      includeExemptedFindings: {
        type: 'boolean',
        description: 'Include exempted findings (default false).',
      },
      ...DESTINATION_PARAM,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,

        properties: {
          displayId: { type: 'string', required: true },
          title: { type: 'string' },
          checkVariant: { type: 'string' },
          clean: { type: 'boolean', required: true },
          findings: ATC_FINDINGS_SCHEMA,
          counts: ATC_COUNTS_SCHEMA,
          aggregates: ATC_AGGREGATES_SCHEMA,
          durationMs: { type: 'integer', required: true },
          rawXml: { type: 'string' },
        },
      },
      render: (_args, value) => {
        const lines = [
          `ATC result ${value.displayId}${value.title ? ` "${value.title}"` : ''}${value.checkVariant ? ` [${value.checkVariant}]` : ''}: ` +
            `${value.clean ? 'CLEAN' : 'findings'} — ` +
            `INFO ${value.counts.INFO}, WARNING ${value.counts.WARNING}, ERROR ${value.counts.ERROR}, ` +
            `CRITICAL ${value.counts.CRITICAL}, CATASTROPHIC ${value.counts.CATASTROPHIC}` +
            atcAggregatesSuffix(value.aggregates),
          ...renderAtcFindings(value.findings),
        ];
        if (value.rawXml && value.findings.length === 0) {
          lines.push('');
          lines.push('(raw response — not checkstyle XML, showing excerpt)');
          lines.push(value.rawXml.slice(0, 2000));
        }
        return text(lines.join('\n'));
      },
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec) => {
      const entry = await registry.require(destinationOf(args), sessionCwd(exec));
      const result = await entry.client.getAtcResult(String(args.displayId), {
        includeExemptedFindings: args.includeExemptedFindings === true,
        signal: exec.signal,
      });
      return {
        displayId: String(args.displayId),
        title: result.title,
        checkVariant: result.checkVariant,
        clean: result.clean,
        findings: result.findings.map(atcFindingOutput),
        counts: result.counts,
        aggregates: result.aggregates,
        durationMs: result.durationMs,
        rawXml: result.rawXml,
      };
    },
  });

  return [listAtcRuns, getAtcResult];
}
