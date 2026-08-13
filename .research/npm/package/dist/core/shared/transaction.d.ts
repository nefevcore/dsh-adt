/**
 * Transaction operations for ABAP objects
 *
 * Retrieves transaction metadata (name, description, package, type) using
 * ADT object properties endpoint.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get transaction properties (metadata) for ABAP transaction
 *
 * Uses ADT object properties endpoint to retrieve transaction information:
 * - Transaction name
 * - Description
 * - Package (if applicable)
 * - Transaction type
 *
 * @param connection - ABAP connection
 * @param transactionName - Transaction code (e.g., 'SE80', 'SE11', 'SM30')
 * @returns Axios response with XML containing transaction properties
 *          Response format: opr:objectProperties with opr:object containing
 *          name, text (description), package, type
 *
 * @example
 * ```typescript
 * const response = await getTransaction(connection, 'SE80');
 * // Response contains XML with transaction properties
 * ```
 */
export declare function getTransaction(connection: IAbapConnection, transactionName: string): Promise<IAdtResponse>;
//# sourceMappingURL=transaction.d.ts.map