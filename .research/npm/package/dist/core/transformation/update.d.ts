import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IUpdateTransformationParams } from './types';
/**
 * Update transformation source code
 * Requires object to be locked first (lockHandle must be provided)
 */
export declare function updateTransformation(connection: IAbapConnection, args: IUpdateTransformationParams, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map