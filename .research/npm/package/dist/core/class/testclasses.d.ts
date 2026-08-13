/**
 * Class test include operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Upload ABAP Unit test classes for an existing class (low-level function).
 * Requires the class to be locked (lock handle) before calling.
 */
export declare function updateClassTestInclude(connection: IAbapConnection, className: string, testClassSource: string, lockHandle: string, transportRequest?: string, sourceContentType?: string): Promise<IAdtResponse>;
export declare function lockClassTestClasses(connection: IAbapConnection, className: string): Promise<string>;
export declare function unlockClassTestClasses(connection: IAbapConnection, className: string, lockHandle: string): Promise<IAdtResponse>;
export declare function activateClassTestClasses(connection: IAbapConnection, className: string, testClassName: string): Promise<IAdtResponse>;
//# sourceMappingURL=testclasses.d.ts.map