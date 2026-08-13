import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateTransformationParams } from './types';
/**
 * Low-level: Create transformation (POST)
 * Does NOT activate - just creates the object
 */
export declare function create(connection: IAbapConnection, args: ICreateTransformationParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map