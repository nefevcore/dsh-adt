/**
 * Enhancement validation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type EnhancementType, type IValidateEnhancementParams } from './types';
/**
 * Validate enhancement name
 * Uses ADT validation endpoint: /sap/bc/adt/enhancements/{type}/validation
 *
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * @param connection - SAP connection
 * @param params - Validation parameters
 * @returns Axios response with validation result
 */
export declare function validateEnhancementName(connection: IAbapConnection, params: IValidateEnhancementParams): Promise<IAdtResponse>;
/**
 * Convenience function: Validate enhancement name with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param packageName - Optional package name
 * @param description - Optional description
 * @returns Axios response
 */
export declare function validate(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string, packageName?: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map