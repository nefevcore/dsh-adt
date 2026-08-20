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
import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, destinationOf, optStr, text, type ToolDeps } from './common.js';

export function executeTools(deps: ToolDeps) {
  const { registry } = deps;

  return [
    defineTool({
      name: 'adt_execute',
      description:
        'Run ABAP code on the SAP system and return its console output. `kind=PROG` runs an executable ' +
        'program (F8 equivalent); `kind=CLAS` runs a class implementing if_oo_adt_classrun (its main( ) ' +
        'executes; out->write lines come back as text). The write→activate→execute→observe loop is how an ' +
        'agent verifies behavior end-to-end. Execution can change system state — guarded by the ' +
        '`allowExecution` policy knob (see adt_permissions).',
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
            output: { type: 'string', required: true, description: 'Console output of the run.' },
            outputLines: { type: 'integer', required: true },
          },
        },
        render: (_args, value) =>
          text([`${value.name} (${value.kind}) exited with HTTP ${value.status}:`, '', value.output || '(no output)'].join('\n')),
      },
      timeoutMs: 330_000,
      execute: async (args, exec) => {
        const entry = registry.require(destinationOf(args));
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
        return {
          kind: result.kind,
          name: result.name,
          status: result.status,
          output: result.output,
          outputLines: lines.length,
        };
      },
    }),
  ];
}
