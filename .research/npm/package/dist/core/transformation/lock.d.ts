import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Lock transformation for modification
 * Returns lock handle that must be used in subsequent requests
 */
export declare function lockTransformation(connection: IAbapConnection, transformationName: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map