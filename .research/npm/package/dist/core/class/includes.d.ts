/**
 * Class include files operations (local types, definitions, macros)
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Update class local types include (implementations)
 *
 * Local helper classes, interface definitions and type declarations.
 * Requires the class to be locked (lock handle) before calling.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param localTypesSource - Local types source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
export declare function updateClassLocalTypes(connection: IAbapConnection, className: string, localTypesSource: string, lockHandle: string, transportRequest?: string, sourceContentType?: string): Promise<IAdtResponse>;
/**
 * Update class-relevant local types include (definitions)
 *
 * Type declarations needed for components in the private section.
 * Requires the class to be locked (lock handle) before calling.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param definitionsSource - Definitions source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
export declare function updateClassDefinitions(connection: IAbapConnection, className: string, definitionsSource: string, lockHandle: string, transportRequest?: string, sourceContentType?: string): Promise<IAdtResponse>;
/**
 * Update class macros include
 *
 * Macro definitions needed in the implementation part of the class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 * Requires the class to be locked (lock handle) before calling.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param macrosSource - Macros source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
export declare function updateClassMacros(connection: IAbapConnection, className: string, macrosSource: string, lockHandle: string, transportRequest?: string, sourceContentType?: string): Promise<IAdtResponse>;
//# sourceMappingURL=includes.d.ts.map