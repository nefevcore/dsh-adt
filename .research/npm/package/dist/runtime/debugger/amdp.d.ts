/**
 * AMDP Debugger for ADT
 *
 * Provides functions for managing AMDP (ABAP Managed Database Procedures) debugger sessions:
 * - Debugger session management (start, resume, terminate)
 * - Debuggee operations
 * - Variable operations (get, set)
 * - Lookup operations
 * - Step operations (step over, continue)
 * - Breakpoint operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Start AMDP debugger
 *
 * @param connection - ABAP connection
 * @param options - Debugger start options
 * @returns Axios response with debugger session
 */
export interface IStartAmdpDebuggerOptions {
    stopExisting?: boolean;
    requestUser?: string;
    cascadeMode?: string;
}
export declare function startAmdpDebugger(connection: IAbapConnection, options?: IStartAmdpDebuggerOptions): Promise<IAdtResponse>;
/**
 * Resume AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with debugger session
 */
export declare function resumeAmdpDebugger(connection: IAbapConnection, mainId: string): Promise<IAdtResponse>;
/**
 * Terminate AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param hardStop - Whether to perform hard stop
 * @returns Axios response
 */
export declare function terminateAmdpDebugger(connection: IAbapConnection, mainId: string, hardStop?: boolean): Promise<IAdtResponse>;
/**
 * Get debuggee information
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response with debuggee information
 */
export declare function getAmdpDebuggee(connection: IAbapConnection, mainId: string, debuggeeId: string): Promise<IAdtResponse>;
/**
 * Get variable value
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @param varname - Variable name
 * @param offset - Offset for variable value
 * @param length - Length of variable value to retrieve
 * @returns Axios response with variable value
 */
export declare function getAmdpVariable(connection: IAbapConnection, mainId: string, debuggeeId: string, varname: string, offset?: number, length?: number): Promise<IAdtResponse>;
/**
 * Set variable value
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @param varname - Variable name
 * @param setNull - Whether to set variable to null
 * @returns Axios response
 */
export declare function setAmdpVariable(connection: IAbapConnection, mainId: string, debuggeeId: string, varname: string, setNull?: boolean): Promise<IAdtResponse>;
/**
 * Lookup objects/variables
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @param name - Name to lookup
 * @returns Axios response with lookup results
 */
export declare function lookupAmdp(connection: IAbapConnection, mainId: string, debuggeeId: string, name?: string): Promise<IAdtResponse>;
/**
 * Step over in AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response
 */
export declare function stepOverAmdp(connection: IAbapConnection, mainId: string, debuggeeId: string): Promise<IAdtResponse>;
/**
 * Continue execution in AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response
 */
export declare function stepContinueAmdp(connection: IAbapConnection, mainId: string, debuggeeId: string): Promise<IAdtResponse>;
/**
 * Get breakpoints
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with breakpoints
 */
export declare function getAmdpBreakpoints(connection: IAbapConnection, mainId: string): Promise<IAdtResponse>;
/**
 * Get breakpoints for LLang
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with LLang breakpoints
 */
export declare function getAmdpBreakpointsLlang(connection: IAbapConnection, mainId: string): Promise<IAdtResponse>;
/**
 * Get breakpoints for table functions
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with table function breakpoints
 */
export declare function getAmdpBreakpointsTableFunctions(connection: IAbapConnection, mainId: string): Promise<IAdtResponse>;
//# sourceMappingURL=amdp.d.ts.map