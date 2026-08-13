import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Lock access control for modification
 * Returns lock handle that must be used in subsequent requests
 */
export declare function lockAccessControl(connection: IAbapConnection, accessControlName: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map