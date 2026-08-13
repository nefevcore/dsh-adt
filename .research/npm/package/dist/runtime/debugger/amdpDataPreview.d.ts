/**
 * AMDP Debugger Data Preview
 *
 * Provides functions for data preview during AMDP debugging:
 * - Data preview for variables
 * - Cell substring retrieval
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get data preview options
 */
export interface IGetAmdpDataPreviewOptions {
    rowNumber?: number;
    colNumber?: number;
    sessionId?: string;
    debuggerId?: string;
    debuggeeId?: string;
    variableName?: string;
    schema?: string;
    provideRowId?: boolean;
    action?: string;
}
/**
 * Get AMDP debugger data preview
 *
 * @param connection - ABAP connection
 * @param options - Data preview options
 * @returns Axios response with data preview
 */
export declare function getAmdpDataPreview(connection: IAbapConnection, options?: IGetAmdpDataPreviewOptions): Promise<IAdtResponse>;
/**
 * Get cell substring options
 */
export interface IGetAmdpCellSubstringOptions {
    rowNumber?: number;
    columnName?: string;
    sessionId?: string;
    debuggerId?: string;
    debuggeeId?: string;
    variableName?: string;
    valueOffset?: number;
    valueLength?: number;
    schema?: string;
    action?: string;
}
/**
 * Get cell substring from AMDP debugger data preview
 *
 * @param connection - ABAP connection
 * @param options - Cell substring options
 * @returns Axios response with cell substring
 */
export declare function getAmdpCellSubstring(connection: IAbapConnection, options?: IGetAmdpCellSubstringOptions): Promise<IAdtResponse>;
//# sourceMappingURL=amdpDataPreview.d.ts.map