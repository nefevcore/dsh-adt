/**
 * List the function modules of a function group via ADT node structure.
 *
 * Thin wrapper over listFunctionGroupChildren for the FUGR/FF child type.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
export declare function listFunctionModules(connection: IAbapConnection, functionGroupName: string): Promise<string[]>;
//# sourceMappingURL=functionModulesList.d.ts.map