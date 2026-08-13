/**
 * Domain delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteDomainParams } from './types';
/**
 * Low-level: Check if domain can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteDomainParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete domain
 */
export declare function deleteDomain(connection: IAbapConnection, params: IDeleteDomainParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map