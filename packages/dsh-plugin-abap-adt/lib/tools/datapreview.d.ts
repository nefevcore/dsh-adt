/**
 * adt_data_preview — read rows from tables / CDS views (or freestyle SQL)
 * via the ADT Data Preview API. Read-only; verifies data after changes.
 *
 * `kind` uses the same type codes as every other adt_* tool (TABL / VIEW /
 * STRU / DDLS), aligned with the ADT URI namespaces (/ddic/tables, /ddic/
 * views, /ddic/structures, /ddls), so the model never has to switch naming
 * schemes mid-session. Note: on ABAP Cloud (BTP) direct preview of database
 * tables is blocked by SAP backend policy — only CDS views / freestyle SQL
 * work there; minimal ADT profiles may not expose the datapreview service at
 * all — the tool then fails with a clear message instead of a raw 404/405.
 */
import { type ToolHost } from '../tooldef.js';
import { type ToolDeps } from './common.js';
export declare function dataPreviewTools(deps: ToolDeps, ctx?: ToolHost): import("../tooldef.js").DefinedTool[];
//# sourceMappingURL=datapreview.d.ts.map