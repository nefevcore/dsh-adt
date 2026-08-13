"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAmdpDebugger = startAmdpDebugger;
exports.resumeAmdpDebugger = resumeAmdpDebugger;
exports.terminateAmdpDebugger = terminateAmdpDebugger;
exports.getAmdpDebuggee = getAmdpDebuggee;
exports.getAmdpVariable = getAmdpVariable;
exports.setAmdpVariable = setAmdpVariable;
exports.lookupAmdp = lookupAmdp;
exports.stepOverAmdp = stepOverAmdp;
exports.stepContinueAmdp = stepContinueAmdp;
exports.getAmdpBreakpoints = getAmdpBreakpoints;
exports.getAmdpBreakpointsLlang = getAmdpBreakpointsLlang;
exports.getAmdpBreakpointsTableFunctions = getAmdpBreakpointsTableFunctions;
const timeouts_1 = require("../../utils/timeouts");
async function startAmdpDebugger(connection, options) {
    const url = `/sap/bc/adt/amdp/debugger/main`;
    const params = {};
    if (options?.stopExisting !== undefined)
        params.stopExisting = options.stopExisting;
    if (options?.requestUser)
        params.requestUser = options.requestUser;
    if (options?.cascadeMode)
        params.cascadeMode = options.cascadeMode;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/start',
        },
    });
}
/**
 * Resume AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with debugger session
 */
async function resumeAmdpDebugger(connection, mainId) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/resume',
        },
    });
}
/**
 * Terminate AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param hardStop - Whether to perform hard stop
 * @returns Axios response
 */
async function terminateAmdpDebugger(connection, mainId, hardStop) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}`;
    const params = {};
    if (hardStop !== undefined)
        params.hardStop = hardStop;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/terminate',
        },
    });
}
/**
 * Get debuggee information
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response with debuggee information
 */
async function getAmdpDebuggee(connection, mainId, debuggeeId) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/debuggee',
        },
    });
}
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
async function getAmdpVariable(connection, mainId, debuggeeId, varname, offset, length) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}/variables/${varname}`;
    const params = {};
    if (offset !== undefined)
        params.offset = offset;
    if (length !== undefined)
        params.length = length;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/vars',
        },
    });
}
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
async function setAmdpVariable(connection, mainId, debuggeeId, varname, setNull) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}/variables/${varname}`;
    const params = {};
    if (setNull !== undefined)
        params.setNull = setNull;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/setvars',
        },
    });
}
/**
 * Lookup objects/variables
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @param name - Name to lookup
 * @returns Axios response with lookup results
 */
async function lookupAmdp(connection, mainId, debuggeeId, name) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}/lookup`;
    const params = {};
    if (name)
        params.name = name;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/lookup',
        },
    });
}
/**
 * Step over in AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response
 */
async function stepOverAmdp(connection, mainId, debuggeeId) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params: { step: 'over' },
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/step/over',
        },
    });
}
/**
 * Continue execution in AMDP debugger
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @param debuggeeId - Debuggee ID
 * @returns Axios response
 */
async function stepContinueAmdp(connection, mainId, debuggeeId) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/debuggees/${debuggeeId}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params: { step: 'continue' },
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/step/continue',
        },
    });
}
/**
 * Get breakpoints
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with breakpoints
 */
async function getAmdpBreakpoints(connection, mainId) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/breakpoints`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/breakpoints',
        },
    });
}
/**
 * Get breakpoints for LLang
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with LLang breakpoints
 */
async function getAmdpBreakpointsLlang(connection, mainId) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/breakpoints`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/breakpoints/llang',
        },
    });
}
/**
 * Get breakpoints for table functions
 *
 * @param connection - ABAP connection
 * @param mainId - Main debugger session ID
 * @returns Axios response with table function breakpoints
 */
async function getAmdpBreakpointsTableFunctions(connection, mainId) {
    const url = `/sap/bc/adt/amdp/debugger/main/${mainId}/breakpoints`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/amdp/debugger/relations/breakpoints/tablefunctions',
        },
    });
}
