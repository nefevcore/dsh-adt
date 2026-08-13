/**
 * FunctionInclude (FUGR/I) lock operation
 * NOTE: Caller should call connection.setSessionType("stateful") before locking.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
/**
 * Lock function include for modification.
 * Returns LOCK_HANDLE that must be passed to update/unlock.
 */
export declare function lockFunctionInclude(connection: IAbapConnection, groupName: string, includeName: string, logger?: ILogger): Promise<string>;
//# sourceMappingURL=lock.d.ts.map