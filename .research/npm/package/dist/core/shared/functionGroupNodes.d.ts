/**
 * Enumerate the children of a function group via ADT node structure.
 *
 * The package/include APIs do not surface a function group's children; only a
 * two-step nodestructure drill-down does (root -> child-type node -> names).
 * This is the shared core behind listFunctionModules (FUGR/FF) and
 * listFunctionGroupIncludes (FUGR/I).
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/** Function-group child node types reachable via the drill-down. */
export type FunctionGroupChildType = 'FUGR/FF' | 'FUGR/I';
/**
 * List the children of a function group that match a given ADT object type.
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Function group name (case-insensitive)
 * @param childType - Child node type to enumerate ('FUGR/FF' modules, 'FUGR/I' includes)
 * @returns Child object names, deduped by uppercased key (first occurrence wins,
 *          document order preserved). `[]` for a valid-empty result; throws on a
 *          malformed, non-2xx, or wrong-shape response.
 */
export declare function listFunctionGroupChildren(connection: IAbapConnection, functionGroupName: string, childType: FunctionGroupChildType): Promise<string[]>;
//# sourceMappingURL=functionGroupNodes.d.ts.map