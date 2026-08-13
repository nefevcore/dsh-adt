/**
 * Interface create operations - Low-level functions (1 function = 1 HTTP request)
 *
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { ICreateInterfaceParams } from './types';
/**
 * Generate minimal interface source code if not provided
 */
export declare function generateInterfaceTemplate(interfaceName: string, description: string): string;
/**
 * Low-level: Create interface object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 */
export declare function create(connection: IAbapConnection, params: ICreateInterfaceParams, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map