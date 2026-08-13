import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock transformation
 * Must use same session and lock handle from lock operation
 */
export declare function unlockTransformation(connection: IAbapConnection, transformationName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map