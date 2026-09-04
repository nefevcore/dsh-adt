/**
 * adt_execute — run ABAP code on the backend and capture its console output.
 *
 *  - PROG: an executable program (`POST /programs/programrun/{name}`) — the
 *    headless equivalent of F8 in ADT.
 *  - CLAS: a class implementing `if_oo_adt_classrun` (`POST /oo/classrun/{name}`)
 *    — its `main( )` runs and every `out->write( )` line comes back.
 *
 * The standard agent pattern: write/modify logic → activate → adt_execute to
 * observe real behavior → assert on the output. Note that execution can
 * change system state arbitrarily (any ABAP can write to the database), so it
 * is guarded by its own policy knob (`allowExecution`, default on — the kill
 * switch for read-only destinations).
 */
import { defineTool } from '../tooldef.js';
import { sessionCwd, DESTINATION_PARAM, destinationOf, optStr, text, type ToolDeps } from './common.js';

/** Console output beyond this is truncated in the tool output (audit P3:
 * an endless WRITE loop used to flood the whole context). */
const MAX_OUTPUT_CHARS = 20_000;

export function executeTools(deps: ToolDeps) {
  const { registry } = deps;

  return [
    defineTool({
      name: 'adt_execute',
      description:
        'Run ABAP code on the SAP system and return its console output. `kind=PROG` runs an executable ' +
        'program (SA38/F8 equivalent); `kind=CLAS` runs a class implementing if_oo_adt_classrun (its main( ) ' +
        'executes; out->write lines come back as text). The write→activate→execute→observe loop is how an ' +
        'agent verifies behavior end-to-end. Execution can change system state — guarded by the ' +
        '`allowExecution` policy knob (see adt_permissions); prd-profile destinations hard-deny it. ' +
        'Output beyond 20k chars is truncated — filter inside the ABAP (write only what you need).',
      parameters: {
        kind: {
          type: 'string',
          enum: ['PROG', 'CLAS'],
          required: true,
          description: 'PROG = executable program, CLAS = if_oo_adt_classrun class.',
        },
        name: { type: 'string', required: true, description: 'Program or class name (uppercase), e.g. ZPROG_DEMO, ZCL_RUNNER.' },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,

          properties: {
            kind: { type: 'string', required: true },
            name: { type: 'string', required: true },
            status: { type: 'integer', required: true },
            output: { type: 'string', required: true, description: 'Console output of the run (truncated beyond 20k chars).' },
            outputLines: { type: 'integer', required: true, description: 'NON-EMPTY lines of the FULL output (not of the truncated copy).' },
            outputTruncated: { type: 'boolean', description: 'true when the output was cut at the 20k-char cap.' },
          },
        },
        render: (_args, value) =>
          text(
            [
              `${value.name} (${value.kind}) exited with HTTP ${value.status}:`,
              '',
              value.output || '(no output)',
              ...(value.outputTruncated ? ['… (output truncated — filter inside the ABAP and re-run)'] : []),
            ].join('\n'),
          ),
      },
      // 330s = worst-case destination client deadline (300s) + margin; a single
      // run call, so no multi-round-trip budget is needed.
      timeoutMs: 330_000,
      execute: async (args, exec) => {
        const entry = await registry.require(destinationOf(args), sessionCwd(exec));
        // Policy is read at call time so a settings hot reload applies immediately.
        entry.policy.assertExecutionAllowed('adt_execute');

        const kind = optStr(args.kind) ?? 'PROG';
        const name = String(args.name ?? '').trim();
        if (!name) throw new Error('adt_execute: `name` is required');
        const result =
          kind === 'CLAS'
            ? await entry.client.runClass(name, { signal: exec.signal })
            : await entry.client.runProgram(name, { signal: exec.signal });
        const lines = result.output.length > 0 ? result.output.split('\n').filter((l) => l.length > 0) : [];
        const truncated = result.output.length > MAX_OUTPUT_CHARS;
        return {
          kind: result.kind,
          name: result.name,
          status: result.status,
          output: truncated ? result.output.slice(0, MAX_OUTPUT_CHARS) : result.output,
          outputLines: lines.length,
          outputTruncated: truncated || undefined,
        };
      },
    }),
  ];
}
