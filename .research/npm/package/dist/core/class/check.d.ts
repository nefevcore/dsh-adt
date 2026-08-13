/**
 * Class check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Check class code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active class: provide className, version='active', omit sourceCode
 * - Existing inactive class: provide className, version='inactive', omit sourceCode
 * - Hypothetical code: provide className, sourceCode, version (object doesn't need to exist)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @returns Check result with errors/warnings
 */
export declare function checkClass(connection: IAbapConnection, className: string, version: 'active' | 'inactive', sourceCode?: string, artifactContentType?: string): Promise<IAdtResponse>;
/**
 * Check class local test class code (syntax, compilation, rules)
 *
 * Validates ABAP Unit test classes in the testclasses include.
 * This is separate from main class check because test classes use a different URI.
 *
 * @param connection - SAP connection
 * @param className - Class name (container class for the test)
 * @param testClassSource - Test class source code to validate
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export declare function checkClassLocalTestClass(connection: IAbapConnection, className: string, testClassSource: string, version?: 'active' | 'inactive', artifactContentType?: string): Promise<IAdtResponse>;
/**
 * Check class local types (implementations include)
 *
 * Validates local helper classes, interface definitions and type declarations
 * in the implementations include file.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param localTypesSource - Local types source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export declare function checkClassLocalTypes(connection: IAbapConnection, className: string, localTypesSource: string, version?: 'active' | 'inactive', artifactContentType?: string): Promise<IAdtResponse>;
/**
 * Check class-relevant local types (definitions include)
 *
 * Validates type declarations needed for components in the private section
 * in the definitions include file.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param definitionsSource - Definitions source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export declare function checkClassDefinitions(connection: IAbapConnection, className: string, definitionsSource: string, version?: 'active' | 'inactive', artifactContentType?: string): Promise<IAdtResponse>;
/**
 * Check class macros
 *
 * Validates macro definitions needed in the implementation part of the class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param macrosSource - Macros source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export declare function checkClassMacros(connection: IAbapConnection, className: string, macrosSource: string, version?: 'active' | 'inactive', artifactContentType?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map