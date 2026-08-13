/**
 * Transport read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get ABAP transport request
 */
export declare function getTransport(connection: IAbapConnection, transportNumber: string): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map