/**
 * Activation Utilities - Centralized ABAP Object Activation Functions
 *
 * Two types of activation endpoints:
 * 1. Individual activation: /sap/bc/adt/activation (for single object in session)
 * 2. Group activation: /sap/bc/adt/activation/runs (for multiple objects)
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Throw unless an activation response is free of error messages.
 *
 * Nine object types each carried a private copy of this check, all written the
 * same way — `activationExecuted && checkExecuted`, with the `<msg>` list never
 * read at all. That shape is wrong twice over:
 *
 * - It refuses a valid response. An object that needs no activation answers
 *   `activationExecuted="false"`, so `AdtClient` threw over objects that were
 *   already active. See `detectActivationFailure` above for the probed table.
 * - It discards what SAP said. A genuine failure carries the reason in
 *   `<msg type="E">` — "Class ZAC_… does not have a TMDIR entry" — and every
 *   copy replaced it with the fixed string "Activation failed".
 *
 * One rule in one place, so the nine cannot drift apart again. Callers keep
 * their own prefix, which is the only part that was ever type-specific.
 *
 * @param objectLabel prefix for the thrown message, e.g. `'Scalar function'`
 * @throws when the response carries at least one error-severity message
 */
export declare function assertActivationSucceeded(objectLabel: string, responseData: unknown): void;
/**
 * Build object URI from name and type
 * Used by both individual and group activation
 *
 * @param name - Object name (e.g., 'ZCL_MY_CLASS', 'Z_MY_PROGRAM')
 * @param type - Object type code (e.g., 'CLAS/OC', 'PROG/P', 'DDLS/DF')
 * @param parentName - Parent object name (e.g., function group name for FUGR/FF)
 * @returns ADT URI for the object
 */
export declare function buildObjectUri(name: string, type?: string, parentName?: string): string;
/**
 * Individual object activation (within a session)
 * Used by Update/Create handlers after lock/unlock operations
 *
 * @param connection - ABAP connection instance
 * @param objectUri - ADT URI of the object (e.g., '/sap/bc/adt/oo/classes/zcl_test')
 * @param objectName - Object name in uppercase (e.g., 'ZCL_TEST')
 * @param sessionId - Session ID for stateful operations
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 */
export declare function activateObjectInSession(connection: IAbapConnection, objectUri: string, objectName: string, preaudit?: boolean): Promise<IAdtResponse>;
//# sourceMappingURL=activationUtils.d.ts.map