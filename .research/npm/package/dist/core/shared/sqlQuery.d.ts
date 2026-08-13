/**
 * SQL query operations via ADT Data Preview API
 *
 * ⚠️ ABAP Cloud Limitation: Direct execution of SQL queries through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IGetSqlQueryParams } from './types';
/**
 * Execute freestyle SQL query via SAP ADT Data Preview API
 *
 * @param connection - ABAP connection
 * @param params - SQL query parameters
 * @returns Query results
 */
export declare function getSqlQuery(connection: IAbapConnection, params: IGetSqlQueryParams): Promise<IAdtResponse>;
//# sourceMappingURL=sqlQuery.d.ts.map