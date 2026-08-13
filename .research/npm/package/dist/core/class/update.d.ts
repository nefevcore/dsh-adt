/**
 * Class update operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Update class source code with validation (high-level function)
 *
 * This function:
 * 1. Validates source code using check operation
 * 2. Only updates if validation passes (no errors)
 * 3. Allows warnings to pass through
 *
 * Requires class to be locked first
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param sourceCode - Source code to validate and update
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 * @throws Error if check finds errors or update fails
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function updateClassWithCheck(connection: IAbapConnection, className: string, sourceCode: string, lockHandle: string, transportRequest?: string, sourceContentType?: string): Promise<IAdtResponse>;
/**
 * Update class source code (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function updateClass(connection: IAbapConnection, className: string, sourceCode: string, lockHandle: string, transportRequest?: string, sourceContentType?: string): Promise<IAdtResponse>;
/**
 * Update class implementations include (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function updateClassImplementations(connection: IAbapConnection, className: string, implementationCode: string, lockHandle: string, transportRequest?: string, sourceContentType?: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map