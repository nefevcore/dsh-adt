/**
 * Class test include operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock test classes for a class
 */
export declare function lockClassTestClasses(connection: IAbapConnection, className: string): Promise<string>;
/**
 * Update test class source code
 */
export declare function updateClassTestInclude(connection: IAbapConnection, className: string, testClassSource: string, lockHandle: string, transportRequest?: string): Promise<IAdtResponse>;
/**
 * Unlock test classes
 */
export declare function unlockClassTestClasses(connection: IAbapConnection, className: string, lockHandle: string): Promise<IAdtResponse>;
/**
 * Activate test classes
 */
export declare function activateClassTestClasses(connection: IAbapConnection, className: string, testClassName: string): Promise<IAdtResponse>;
//# sourceMappingURL=classTest.d.ts.map