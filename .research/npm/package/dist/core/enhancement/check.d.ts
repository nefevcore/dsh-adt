/**
 * Enhancement check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type EnhancementType, type ICheckEnhancementParams } from './types';
/**
 * Check enhancement syntax/consistency
 *
 * @param connection - SAP connection
 * @param params - Check parameters
 * @returns Axios response with check result
 */
export declare function checkEnhancement(connection: IAbapConnection, params: ICheckEnhancementParams): Promise<IAdtResponse>;
/**
 * Convenience function: Check enhancement with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param version - 'active' or 'inactive' (default: 'inactive')
 * @param sourceCode - Optional source code for live validation
 * @returns Axios response
 */
export declare function check(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string, version?: 'active' | 'inactive', sourceCode?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map