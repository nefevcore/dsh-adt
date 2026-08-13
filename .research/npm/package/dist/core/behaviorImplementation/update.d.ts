/**
 * Behavior Implementation update operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Update behavior implementation class implementations include source code (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function updateBehaviorImplementation(connection: IAbapConnection, className: string, sourceCode: string, lockHandle: string, transportRequest?: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map