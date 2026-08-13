import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate access control name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export declare function validateAccessControlName(connection: IAbapConnection, accessControlName: string, packageName?: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map