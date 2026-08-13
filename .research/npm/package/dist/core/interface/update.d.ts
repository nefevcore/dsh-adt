/**
 * Interface update operations - Low-level function
 * Use AdtInterface.update() for high-level operations
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Low-level: Upload interface source code (PUT)
 * Requires lock handle - does NOT lock/unlock
 */
export declare function upload(connection: IAbapConnection, interfaceName: string, sourceCode: string, lockHandle: string, corrNr: string | undefined, sourceContentType?: string): Promise<void>;
//# sourceMappingURL=update.d.ts.map