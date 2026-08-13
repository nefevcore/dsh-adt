import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate transformation name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export declare function validateTransformationName(connection: IAbapConnection, transformationName: string, packageName?: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map