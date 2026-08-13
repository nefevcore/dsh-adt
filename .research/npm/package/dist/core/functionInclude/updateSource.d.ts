/**
 * FunctionInclude (FUGR/I) source upload operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Does NOT lock/unlock — assumes the object is already locked.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Upload function include source code (low-level; uses an existing lockHandle).
 *
 * @param unicode when true, Content-Type is "text/plain; charset=utf-8";
 *                when false, plain "text/plain" (for legacy non-unicode systems).
 */
export declare function uploadFunctionIncludeSource(connection: IAbapConnection, groupName: string, includeName: string, sourceCode: string, lockHandle: string, unicode: boolean, transportRequest?: string): Promise<void>;
//# sourceMappingURL=updateSource.d.ts.map