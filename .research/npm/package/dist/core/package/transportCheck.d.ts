/**
 * Package transport check operations
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ICreatePackageParams } from './types';
/**
 * Step 2: Check transport requirements
 */
export declare function checkTransportRequirements(connection: IAbapConnection, args: ICreatePackageParams, transportLayer: string): Promise<string[]>;
//# sourceMappingURL=transportCheck.d.ts.map