# Agent Guide — using the `adt_*` tools well

> Written FOR AI agents (and the humans reviewing them). Read the
> limitations first: they are the difference between one round-trip and five.
> Human-facing reference of every tool: [`tool-reference.md`](tool-reference.md).

## Critical limitations (read first)

### 1. Data-preview SQL is ABAP SQL, not standard SQL

`adt_data_preview` (freestyle SQL) goes through the ADT data-preview engine —
the same one ADT/Eclipse uses. Its dialect differs from what you may assume:

| You might write | Verdict | Write instead |
|---|---|---|
| `ORDER BY col DESC` | ❌ rejected | `ORDER BY col DESCENDING` |
| `ORDER BY col ASC` | ❌ rejected | `ORDER BY col ASCENDING` |
| `LIMIT n` | ❌ not recognized | the `length` parameter (1–500) |
| `GROUP BY`, `COUNT(*)`, `WHERE` | ✅ works | — |
| Paging | use `offset`/`length` params | client-side windows |

### 2. Writing is not activating — and activation does not cascade

`adt_write_object`/`adt_edit_object` SAVE the source (pass `activate: true`
to activate in the same call). Activating a PROG main program does NOT
cascade to its includes on most backends: pass the main object AND its
includes in ONE `adt_activate`/`adt_check` call. Inactive objects are listed
by package tools before a gate run.

### 3. Transports: the backend decides on lock; policy can still refuse

When you omit `transport`, the backend records the change into the object's
existing open request — or auto-creates a NEW task for a fresh object. The
backend-assigned request must still pass the destination policy; a refusal
names the rule. **Releasing a transport is a human decision — there is
deliberately no release tool.**

### 4. Read before edit — the OCC contract

`adt_read_object` keeps a local snapshot with the server content hash.
`adt_edit_object` matches your quote against THAT snapshot and hash-verifies
the server under the lock: if anyone changed the object since your read you
get `[CONFLICT]` and nothing is applied — re-read, redo. After every write
the source is read back and verified (`persisted` in the output):
`persisted: false` means a concurrent editor of the SAME account overwrote
your change — treat it as a hard failure and never activate that state.

### 5. Mutating tools refuse fuzzy resolution

A near-miss `name` with only fuzzy search hits is an ERROR for write/edit/
delete/activate — never a silent fallback onto a different object. Pass
`objectUri` (from search/read output) or the exact name (+ type).

### 5a. Structured metadata objects are not source

MSAG/DOMA/DTEL/TTYP have no plain source: `adt_read_object` refuses them and
points at `adt_read_structure` (packages point at `adt_package_content`).
The reverse holds too — reading a class "as structure" is refused with a
pointer back. One right door per object kind.

### 6. List answers are bounded, and they say so

Search/dumps/preview results are capped (search backend cap 100 hits with
client-side `offset` paging; dumps `top` ≤ 100 with a fetch-one-beyond
trick). Every capped answer carries a note naming the parameter that widens
it (`raise top`, `offset=…`). An empty list with no note is a TRUE empty.

## Reading efficiently (token economy)

| Need | Use | Cost |
|---|---|---|
| One method of a big class | `adt_read_object {method: "NAME"}` | ~30 lines |
| Understand an object + its collaborators | `adt_read_object {context: true}` | source + compressed contracts |
| Find where something lives | `adt_search` (then read windows) | hits, not sources |
| A slice of a huge object | `startLine`/`endLine` windows | bounded |

- **Method-level read**: the window addresses the FULL source's line numbers
  (`startLine`/`endLine`/`totalLines` of the whole object), so a follow-up
  edit by position lines up with what you saw.
- **Context prologue** (`context: true`): appends the PUBLIC contracts of
  the classes/interfaces the source uses — superclass and interfaces first,
  then signature types, collaborators, exceptions. Unresolved dependencies
  are listed visibly (they are still dependencies); function-module calls
  are listed with their call counts. Budget: `contextDeps` (default 8).

## Editing decision tree

```
Need to change an ABAP object?
├─ one method of a class            → adt_edit_object {method, newText}   (send only the block)
├─ a precise spot you can quote     → adt_edit_object {oldText, newText}  (quote verbatim from your read)
├─ a whole FORM/MODULE/block        → adt_edit_object {start, end}        (bare closers resolve structurally)
├─ a rewrite / new file on disk     → adt_write_object {source|sourceFile}
└─ huge file / local tooling        → read (snapshot) → edit the localCopy file → adt_push_object
```

Ambiguity is always an error that lists the candidates (`occurrence` picks
one); not-found errors list the closest lines so one re-read converges.

**Creating a table?** `adt_create_object {type:"TABL", fields:[…]}` generates
DDIC 2.0 DDL (auto MANDT key) and ACTIVATES in one call — the output echoes
the DDL it wrote. Field labels come from the field `description` or a data
element passed as `type`. Need the selection-screen texts of a program you
are about to change? `adt_read_textelements` returns them as textpool rows
(I/S/H) in one read.

**One call, any verb?** `adt_crud {verb, type, name, …}` routes create/read/
update/delete to the dedicated tool that owns that verb×type — same policy
and conflict checks as calling it directly (`routedTool` in the answer says
which ran). Calling it without `verb` returns the capability matrix. Use the
dedicated tools directly when you need their advanced flows (method surgery,
block edits, context reads, local snapshots).

### Before you write: show the diff, run the check

Two workflow rules separate reviewable changes from drive-by edits:

1. **Show a Before/After diff before anything lands on SAP.** Present the
   changed block(s) to the user — old lines, new lines, nothing else — and
   let the change land only once the diff is visible in the conversation.
   Small or "obvious" edits are no exception: the user must be able to veto
   what they never saw. (For `adt_edit_object` the quote/new pair IS the
   diff; for `adt_write_object` show a unified diff against your last read.)
2. **Check before you push big changes.** Small surgical edits via
   `adt_edit_object` already run a syntax check on the full source
   afterwards. For whole-object rewrites (`adt_write_object` / 
   `adt_push_object`), run `adt_check` on the object BEFORE writing — a
   syntax error found after the write leaves an inactive broken object
   sitting under a released lock, and check-before-write avoids exactly
   that (check → lock → write → activate, never lock first).

## Scale and verification

- `adt_batch` — protocol-level `$batch` GET fan-out (≤50 parts, one HTTP round-trip).
- `adt_release_gate` — whole-package syntax + unit tests + ATC with a go/no-go verdict.
- `adt_local_check` — export sources and run abaplint OFFLINE before pushing anything.
- `adt_cochange` — what usually changes together with these objects
  (transport co-occurrence): scope the regression set before an edit.
- `adt_selfcheck` — capability sweep of the destination (read-only): verifies
  the read-family actually answers, with an independent oracle per capability
  (search↔read↔$batch↔package-content consistency). `dead` = returned
  nothing while the oracle says content exists. Run it when connecting a new
  system or after an upgrade; the report names every tool it did NOT probe.

## Error analysis loop

`adt_execute` (console output) → `adt_list_dumps` / `adt_get_dump` (ST22:
header, stack, termination point) → read the failing object (method-level +
context) → fix → `adt_check` → `adt_run_unit_tests` → gate.

## Live debugging (when reading is not enough)

The `adt_debug_*` family speaks the standard ADT debugger — no server-side
install — but it is **off by default** (`allowDebugger` policy; variable
WRITES additionally need `allowDebugVariables`). The loop:

```
adt_debug_breakpoint {action:"set", name, type, line}   → breakpoint id
adt_debug_session   {action:"listen"}                   → BREAKPOINT HIT (empty = no hit yet)
adt_debug_inspect   {action:"stack"}                    → where we are
adt_debug_inspect   {action:"variables", variables:[…]} → what the values are
adt_debug_step      {step:"stepOver" | "stepInto" | …}  → advance (F5/F6/F7/F8)
adt_debug_session   {action:"detach"}                   → always end with this
```

Facts that save round-trips:

- One destination holds ONE debug session; after `detach` a fresh `listen`
  starts a new identity — you cannot "re-attach".
- Breakpoints are external-scope: they fire when the TARGET USER runs the
  code (default: the destination user). Standard (SAP) code breakpoints
  often do not trigger — SAP defaults to customer-code-only debugging.
- `stack` is unavailable on older releases (BASIS < ~7.51) — reported as
  `unavailable`, stepping and variables still work.
- `listen` waits (long-poll, default 30 s): set the breakpoint FIRST, then
  trigger the code path (e.g. `adt_execute`), then listen.
- Changing variable values (`adt_debug_set_variable`) is the highest-risk
  call in the family — double opt-in by design.

## Policy errors are refusals, not failures

`[POLICY]` errors mean the destination's configuration said no (package
whitelist, transport rules, execution or batch-write kill switches) — do not
retry with variations; ask the human or switch destination. Check
`adt_permissions` to see the effective rules before planning writes.

### Destination profiles: dev / qa / prd

Each destination may carry an environment `profile` (default `dev`). It only
ever TIGHTENS the knobs:

| profile | execution (`adt_execute`) | batch writes | effect |
|---|---|---|---|
| `dev` | as configured | as configured | plain knob semantics |
| `qa` | defaults **off** | defaults **off** | explicit config/env values still open them |
| `prd` | **hard-denied** | **hard-denied** | not even an explicit `allowExecution: true` opens them — run on a dev/qa destination instead |

The prd denial message says `profile: prd` so you know it is the tier, not a
knob you could ask to flip.

### Read-side governance: `blockedTables`

The write-side knobs have a read-side counterpart for row-returning reads
(`adt_data_preview`). When a destination sets `blockedTablesProfile`
(opt-in; `off` by default), reads of sensitive tables are refused BEFORE any
request is sent, with the category and reason in the error — banking data,
customer/vendor PII, addresses, authentication tables, HR/payroll, tax IDs
(`minimal`); plus transactional documents with linked PII (`standard`);
plus audit logs, communication/workflow payloads, and the `Z*` namespace
(`strict`). A deny can never be argued away per call. The sanctioned bypass
is a config-level `allowedTables` exemption — those reads pass and carry an
audited note in the output. Reading DDIC metadata (`adt_read_structure`) is
never affected; only rows are governed.
