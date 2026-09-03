/**
 * adt_read_object — read an object's source and metadata. `startLine` /
 * `endLine` (1-based, inclusive) window the source so huge objects can be
 * read in slices; the response always carries `totalLines` for paging.
 * Full reads (no window) up to a size cap replay as a line-numbered read
 * card; windowed reads render inline.
 *
 * By default the FULL source is also kept as a LOCAL SNAPSHOT
 * (`.adt-snapshots/<destination>/…`, sandbox-aware) with the server content
 * hash in a sidecar — the base of the conflict-checked edit/push flow
 * (adt_edit_object matches against this snapshot; adt_push_object uploads a
 * locally edited copy after verifying the server still matches).
 */
import { type ToolHost } from '../tooldef.js';
import { type ToolDeps } from './common.js';
export declare function readTools(deps: ToolDeps, ctx?: ToolHost): import("../tooldef.js").DefinedTool[];
//# sourceMappingURL=read.d.ts.map