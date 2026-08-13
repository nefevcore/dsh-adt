/**
 * Application Log Objects
 *
 * Provides functions for reading application log objects:
 * - Get application log object properties
 * - Get application log object source
 * - Validate application log object name
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get application log object options
 */
export interface IGetApplicationLogObjectOptions {
    corrNr?: string;
    lockHandle?: string;
    version?: string;
    accessMode?: string;
    action?: string;
}
/**
 * Get application log object properties
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name
 * @param options - Optional parameters
 * @returns Axios response with application log object properties
 */
export declare function getApplicationLogObject(connection: IAbapConnection, objectName: string, options?: IGetApplicationLogObjectOptions): Promise<IAdtResponse>;
/**
 * Get application log object source options
 */
export interface IGetApplicationLogSourceOptions {
    corrNr?: string;
    lockHandle?: string;
    version?: string;
}
/**
 * Get application log object source
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name
 * @param options - Optional parameters
 * @returns Axios response with application log object source
 */
export declare function getApplicationLogSource(connection: IAbapConnection, objectName: string, options?: IGetApplicationLogSourceOptions): Promise<IAdtResponse>;
/**
 * Validate application log object name
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name to validate
 * @returns Axios response with validation result
 */
export declare function validateApplicationLogName(connection: IAbapConnection, objectName: string): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map