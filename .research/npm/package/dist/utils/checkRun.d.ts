/**
 * Shared check run utilities
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
interface CheckMessage {
    type: string;
    text: string;
    line: string;
    href: string;
    code?: string;
    msgId?: string;
    msgNo?: string;
}
/**
 * Get ADT URI for object type
 */
export declare function getObjectUri(objectType: string, objectName: string): string;
/**
 * Build check run XML payload
 */
/**
 * Build XML body for checkRun request (checks code already in SAP system)
 *
 * Format: Simple URI + version
 * - version="inactive": Checks saved but not activated code
 * - version="active": Checks activated code
 *
 * SAP reads the code from system itself.
 */
/**
 * Which stored version of an object a check run should look at.
 *
 * - `active`   — the activated version.
 * - `inactive` — saved but not yet activated.
 * - `new`      — created and never activated, so no inactive version exists
 *                either. This is what ADT itself sends while an object is
 *                still being written: the trace of an Eclipse session creating
 *                an append structure shows `chkrun:version="new"` on every
 *                as-you-type check.
 *
 * Previously this was a bare `string` defaulting to `'active'`, and only the
 * first two were documented — so `new` was reachable but unnamed, which is a
 * poor way to offer a choice.
 */
export type CheckRunVersion = 'active' | 'inactive' | 'new';
export declare function buildCheckRunXml(objectUri: string, version?: CheckRunVersion): string;
/**
 * Build XML body for checkRun request with source code (live validation)
 *
 * Used for checking code that hasn't been saved to SAP yet.
 * SAP will validate the provided source code instead of reading from system.
 *
 * @param objectUri - ADT URI of the object (e.g., /sap/bc/adt/oo/classes/zcl_test)
 * @param sourceCode - Source code to validate
 * @param version - 'active' or 'inactive' (typically 'active' for live validation)
 */
export declare function buildCheckRunXmlWithSource(objectUri: string, sourceCode: string, version?: CheckRunVersion, artifactContentType?: string): string;
/**
 * Parse check run response
 */
export declare function parseCheckRunResponse(response: IAdtResponse): {
    success: boolean;
    status: string;
    message: string;
    errors: CheckMessage[];
    warnings: CheckMessage[];
    info: CheckMessage[];
    total_messages: number;
    has_errors: boolean;
    has_warnings: boolean;
};
/**
 * Run check run for any object type
 */
export declare function runCheckRun(connection: IAbapConnection, objectType: string, objectName: string, version?: CheckRunVersion, reporter?: string, sourceCode?: string, artifactContentType?: string): Promise<IAdtResponse>;
/**
 * Run a check on an object with unsaved source code (live validation).
 *
 * This function validates source code that hasn't been saved to SAP yet,
 * similar to real-time validation in Eclipse ADT editor during typing.
 *
 * @param connection - The ABAP connection
 * @param objectType - Type of object (e.g., 'class', 'program')
 * @param objectName - Name of the object
 * @param sourceCode - The source code to validate
 * @param version - Version to validate against ('active' or 'inactive')
 * @param reporter - Reporter type for check results
 * @param sessionId - Optional session ID for session-based requests
 * @returns Promise resolving to IAdtResponse with check results
 */
export declare function runCheckRunWithSource(connection: IAbapConnection, objectType: string, objectName: string, sourceCode: string, version?: CheckRunVersion, reporter?: string, artifactContentType?: string): Promise<IAdtResponse>;
/**
 * Run a check repeatedly until the report comes back with no messages at all.
 *
 * This is what ADT itself does. A trace of an Eclipse session writing an append
 * structure shows six `POST /checkruns` in a row while the source is being
 * completed — each answering ~1.2 KB of messages — and then one final answer of
 * 0.3 KB carrying an empty report:
 *
 * ```xml
 * <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:status="processed"
 *   chkrun:statusText="Object ZADT_S_APPEND_S has been checked"/>
 * ```
 *
 * Only then does Eclipse send the PUT. Two earlier readings of that trace were
 * wrong and are worth naming: it does **not** ignore check errors and write
 * anyway, and the repetition is not idle chatter — a clean report is the
 * precondition for writing.
 *
 * Waiting matters because no ADT operation that changes system state guarantees
 * when the change becomes visible: a base object activated moments earlier can
 * still be reported as unextendable until DDIC catches up.
 *
 * @throws the last set of messages if the report never comes back clean.
 */
export declare function waitForCleanCheckRun(connection: IAbapConnection, objectType: string, objectName: string, version: CheckRunVersion, sourceCode: string | undefined, options?: {
    attempts?: number;
    delayMs?: number;
    logger?: ILogger;
}): Promise<IAdtResponse>;
export {};
//# sourceMappingURL=checkRun.d.ts.map