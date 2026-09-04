/**
 * Destination-management tools (workspace config):
 *
 *   - `adt_list_gui_connections` — search the local SAP GUI (SAP Logon)
 *     landscape so the agent can offer the user matching systems to import.
 *   - `adt_create_destination` — create or update a destination in the
 *     session workspace file `<cwd>/<host config dir>/destinations.yaml`, either
 *     from explicit fields or by importing a discovered GUI connection.
 *
 * Together they cover the conversational flow: the user asks for a
 * connection ("create the impc config"), the agent searches the GUI
 * landscape, either offers the matches for a choice or — when no GUI is
 * installed — asks for url/client/username, then writes the file. The next
 * `adt_*` call in the same workspace sees the new destination (the registry
 * resolves the workspace layer per call).
 */
import { type ToolHost } from '../tooldef.js';
import { type ToolDeps } from './common.js';
export declare function destinationTools(deps: ToolDeps, ctx: ToolHost): import("../tooldef.js").DefinedTool[];
//# sourceMappingURL=destinations.d.ts.map