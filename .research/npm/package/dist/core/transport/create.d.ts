/**
 * Transport create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateTransportParams } from './types';
/**
 * Create ABAP transport request
 */
export declare function createTransport(connection: IAbapConnection, params: ICreateTransportParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map