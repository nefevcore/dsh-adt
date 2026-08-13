/**
 * ABAP Debugger (Standard)
 *
 * Provides functions for managing ABAP debugger sessions:
 * - Debugger listeners (launch, stop, get)
 * - Memory sizes
 * - System areas
 * - Breakpoints (synchronize, statements, message types, conditions, validation, VIT)
 * - Variables (max length, subcomponents, CSV, JSON, value statement)
 * - Actions (execute debugger actions)
 * - Call stack
 * - Watchpoints (insert, get)
 * - Batch requests
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Launch debugger
 *
 * @param connection - ABAP connection
 * @param options - Debugger launch options
 * @returns Axios response with debugger session
 */
export interface ILaunchDebuggerOptions {
    debuggingMode?: string;
    requestUser?: string;
    terminalId?: string;
    ideId?: string;
    timeout?: number;
    checkConflict?: boolean;
    isNotifiedOnConflict?: boolean;
}
export declare function launchDebugger(connection: IAbapConnection, options?: ILaunchDebuggerOptions): Promise<IAdtResponse>;
/**
 * Stop debugger
 *
 * @param connection - ABAP connection
 * @param options - Debugger stop options
 * @returns Axios response
 */
export interface IStopDebuggerOptions {
    debuggingMode?: string;
    requestUser?: string;
    terminalId?: string;
    ideId?: string;
    checkConflict?: boolean;
    notifyConflict?: boolean;
}
export declare function stopDebugger(connection: IAbapConnection, options?: IStopDebuggerOptions): Promise<IAdtResponse>;
/**
 * Get debugger session
 *
 * @param connection - ABAP connection
 * @param options - Debugger get options
 * @returns Axios response with debugger session
 */
export interface IGetDebuggerOptions {
    debuggingMode?: string;
    requestUser?: string;
    terminalId?: string;
    ideId?: string;
    checkConflict?: boolean;
}
export declare function getDebugger(connection: IAbapConnection, options?: IGetDebuggerOptions): Promise<IAdtResponse>;
/**
 * Get memory sizes
 *
 * @param connection - ABAP connection
 * @param includeAbap - Include ABAP memory (optional)
 * @returns Axios response with memory sizes
 */
export declare function getMemorySizes(connection: IAbapConnection, includeAbap?: boolean): Promise<IAdtResponse>;
/**
 * Get system area
 *
 * @param connection - ABAP connection
 * @param systemarea - System area name
 * @param options - System area options
 * @returns Axios response with system area data
 */
export interface IGetSystemAreaOptions {
    offset?: number;
    length?: number;
    element?: string;
    isSelection?: boolean;
    selectedLine?: number;
    selectedColumn?: number;
    programContext?: string;
    filter?: string;
}
export declare function getSystemArea(connection: IAbapConnection, systemarea: string, options?: IGetSystemAreaOptions): Promise<IAdtResponse>;
/**
 * Synchronize breakpoints
 *
 * @param connection - ABAP connection
 * @param checkConflict - Check for conflicts (optional)
 * @returns Axios response with breakpoints
 */
export declare function synchronizeBreakpoints(connection: IAbapConnection, checkConflict?: boolean): Promise<IAdtResponse>;
/**
 * Get breakpoint statements
 *
 * @param connection - ABAP connection
 * @returns Axios response with breakpoint statements
 */
export declare function getBreakpointStatements(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get breakpoint message types
 *
 * @param connection - ABAP connection
 * @returns Axios response with message types
 */
export declare function getBreakpointMessageTypes(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get breakpoint conditions
 *
 * @param connection - ABAP connection
 * @returns Axios response with breakpoint conditions
 */
export declare function getBreakpointConditions(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Validate breakpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with validation results
 */
export declare function validateBreakpoints(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get VIT breakpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with VIT breakpoints
 */
export declare function getVitBreakpoints(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Get variable max length
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param maxLength - Max length (optional)
 * @returns Axios response with max length
 */
export declare function getVariableMaxLength(connection: IAbapConnection, variableName: string, part: string, maxLength?: number): Promise<IAdtResponse>;
/**
 * Get variable subcomponents
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param component - Component name (optional)
 * @param line - Line number (optional)
 * @returns Axios response with subcomponents
 */
export declare function getVariableSubcomponents(connection: IAbapConnection, variableName: string, part: string, component?: string, line?: number): Promise<IAdtResponse>;
/**
 * Get variable as CSV
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param options - CSV options
 * @returns Axios response with CSV data
 */
export interface IGetVariableAsCsvOptions {
    offset?: number;
    length?: number;
    filter?: string;
    sortComponent?: string;
    sortDirection?: string;
    whereClause?: string;
    c?: string;
}
export declare function getVariableAsCsv(connection: IAbapConnection, variableName: string, part: string, options?: IGetVariableAsCsvOptions): Promise<IAdtResponse>;
/**
 * Get variable as JSON
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param options - JSON options
 * @returns Axios response with JSON data
 */
export interface IGetVariableAsJsonOptions {
    offset?: number;
    length?: number;
    filter?: string;
    sortComponent?: string;
    sortDirection?: string;
    whereClause?: string;
    c?: string;
}
export declare function getVariableAsJson(connection: IAbapConnection, variableName: string, part: string, options?: IGetVariableAsJsonOptions): Promise<IAdtResponse>;
/**
 * Get variable value statement
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param options - Value statement options
 * @returns Axios response with value statement
 */
export interface IGetVariableValueStatementOptions {
    rows?: number;
    maxStringLength?: number;
    maxNestingLevel?: number;
    maxTotalSize?: number;
    ignoreInitialValues?: boolean;
    c?: string;
    lineBreakThreshold?: number;
}
export declare function getVariableValueStatement(connection: IAbapConnection, variableName: string, part: string, options?: IGetVariableValueStatementOptions): Promise<IAdtResponse>;
/**
 * Execute debugger action
 *
 * @param connection - ABAP connection
 * @param action - Action name
 * @param value - Action value (optional)
 * @returns Axios response
 */
export declare function executeDebuggerAction(connection: IAbapConnection, action: string, value?: string): Promise<IAdtResponse>;
/**
 * Get call stack
 *
 * @param connection - ABAP connection
 * @returns Axios response with call stack
 */
export declare function getCallStack(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Insert watchpoint
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param condition - Watchpoint condition (optional)
 * @returns Axios response
 */
export declare function insertWatchpoint(connection: IAbapConnection, variableName: string, condition?: string): Promise<IAdtResponse>;
/**
 * Get watchpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with watchpoints
 */
export declare function getWatchpoints(connection: IAbapConnection): Promise<IAdtResponse>;
/**
 * Execute batch request
 *
 * @param connection - ABAP connection
 * @param requests - Batch requests (XML body)
 * @returns Axios response with batch results
 */
export declare function executeBatchRequest(connection: IAbapConnection, requests: string): Promise<IAdtResponse>;
export type IAbapDebuggerStepMethod = 'stepInto' | 'stepOut' | 'stepContinue';
export interface IDebuggerBatchPayload {
    boundary: string;
    body: string;
}
export declare function buildDebuggerBatchPayload(requests: string[], boundary?: string): IDebuggerBatchPayload;
export declare function buildDebuggerStepWithStackBatchPayload(stepMethod: IAbapDebuggerStepMethod): IDebuggerBatchPayload;
export declare function executeDebuggerStepBatch(connection: IAbapConnection, stepMethod: IAbapDebuggerStepMethod): Promise<IAdtResponse>;
export declare function stepIntoDebuggerBatch(connection: IAbapConnection): Promise<IAdtResponse>;
export declare function stepOutDebuggerBatch(connection: IAbapConnection): Promise<IAdtResponse>;
export declare function stepContinueDebuggerBatch(connection: IAbapConnection): Promise<IAdtResponse>;
//# sourceMappingURL=abap.d.ts.map