/**
 * Table contents operations via ADT DDIC Data Preview API
 *
 * Retrieves table metadata to build field list, then uses the DDIC Data Preview
 * endpoint with POST and SQL query in body (TABLE~FIELD syntax, same as Eclipse ADT).
 *
 * ⚠️ ABAP Cloud Limitation: Direct access to table data through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IGetTableContentsParams } from './types';
/**
 * Get table contents via ADT DDIC Data Preview API
 *
 * @param connection - ABAP connection
 * @param params - Table contents parameters
 * @returns Table contents
 */
export declare function getTableContents(connection: IAbapConnection, params: IGetTableContentsParams): Promise<IAdtResponse>;
//# sourceMappingURL=tableContents.d.ts.map