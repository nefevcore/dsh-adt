"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchDebugger = launchDebugger;
exports.stopDebugger = stopDebugger;
exports.getDebugger = getDebugger;
exports.getMemorySizes = getMemorySizes;
exports.getSystemArea = getSystemArea;
exports.synchronizeBreakpoints = synchronizeBreakpoints;
exports.getBreakpointStatements = getBreakpointStatements;
exports.getBreakpointMessageTypes = getBreakpointMessageTypes;
exports.getBreakpointConditions = getBreakpointConditions;
exports.validateBreakpoints = validateBreakpoints;
exports.getVitBreakpoints = getVitBreakpoints;
exports.getVariableMaxLength = getVariableMaxLength;
exports.getVariableSubcomponents = getVariableSubcomponents;
exports.getVariableAsCsv = getVariableAsCsv;
exports.getVariableAsJson = getVariableAsJson;
exports.getVariableValueStatement = getVariableValueStatement;
exports.executeDebuggerAction = executeDebuggerAction;
exports.getCallStack = getCallStack;
exports.insertWatchpoint = insertWatchpoint;
exports.getWatchpoints = getWatchpoints;
exports.executeBatchRequest = executeBatchRequest;
exports.buildDebuggerBatchPayload = buildDebuggerBatchPayload;
exports.buildDebuggerStepWithStackBatchPayload = buildDebuggerStepWithStackBatchPayload;
exports.executeDebuggerStepBatch = executeDebuggerStepBatch;
exports.stepIntoDebuggerBatch = stepIntoDebuggerBatch;
exports.stepOutDebuggerBatch = stepOutDebuggerBatch;
exports.stepContinueDebuggerBatch = stepContinueDebuggerBatch;
const buildBatchPayload_1 = require("../../batch/buildBatchPayload");
const timeouts_1 = require("../../utils/timeouts");
async function launchDebugger(connection, options) {
    const url = `/sap/bc/adt/debugger/listeners`;
    const params = {};
    if (options?.debuggingMode)
        params.debuggingMode = options.debuggingMode;
    if (options?.requestUser)
        params.requestUser = options.requestUser;
    if (options?.terminalId)
        params.terminalId = options.terminalId;
    if (options?.ideId)
        params.ideId = options.ideId;
    if (options?.timeout !== undefined)
        params.timeout = options.timeout;
    if (options?.checkConflict !== undefined)
        params.checkConflict = options.checkConflict;
    if (options?.isNotifiedOnConflict !== undefined)
        params.isNotifiedOnConflict = options.isNotifiedOnConflict;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/launch',
        },
    });
}
async function stopDebugger(connection, options) {
    const url = `/sap/bc/adt/debugger/listeners`;
    const params = {};
    if (options?.debuggingMode)
        params.debuggingMode = options.debuggingMode;
    if (options?.requestUser)
        params.requestUser = options.requestUser;
    if (options?.terminalId)
        params.terminalId = options.terminalId;
    if (options?.ideId)
        params.ideId = options.ideId;
    if (options?.checkConflict !== undefined)
        params.checkConflict = options.checkConflict;
    if (options?.notifyConflict !== undefined)
        params.notifyConflict = options.notifyConflict;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/stop',
        },
    });
}
async function getDebugger(connection, options) {
    const url = `/sap/bc/adt/debugger/listeners`;
    const params = {};
    if (options?.debuggingMode)
        params.debuggingMode = options.debuggingMode;
    if (options?.requestUser)
        params.requestUser = options.requestUser;
    if (options?.terminalId)
        params.terminalId = options.terminalId;
    if (options?.ideId)
        params.ideId = options.ideId;
    if (options?.checkConflict !== undefined)
        params.checkConflict = options.checkConflict;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/get',
        },
    });
}
/**
 * Get memory sizes
 *
 * @param connection - ABAP connection
 * @param includeAbap - Include ABAP memory (optional)
 * @returns Axios response with memory sizes
 */
async function getMemorySizes(connection, includeAbap) {
    const url = `/sap/bc/adt/debugger/memorysizes`;
    const params = {};
    if (includeAbap !== undefined)
        params.includeAbap = includeAbap;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
        },
    });
}
async function getSystemArea(connection, systemarea, options) {
    if (!systemarea) {
        throw new Error('System area is required');
    }
    const url = `/sap/bc/adt/debugger/systemareas/${encodeURIComponent(systemarea)}`;
    const params = {};
    if (options?.offset !== undefined)
        params.offset = options.offset;
    if (options?.length !== undefined)
        params.length = options.length;
    if (options?.element)
        params.element = options.element;
    if (options?.isSelection !== undefined)
        params.isSelection = options.isSelection;
    if (options?.selectedLine !== undefined)
        params.selectedLine = options.selectedLine;
    if (options?.selectedColumn !== undefined)
        params.selectedColumn = options.selectedColumn;
    if (options?.programContext)
        params.programContext = options.programContext;
    if (options?.filter)
        params.filter = options.filter;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Synchronize breakpoints
 *
 * @param connection - ABAP connection
 * @param checkConflict - Check for conflicts (optional)
 * @returns Axios response with breakpoints
 */
async function synchronizeBreakpoints(connection, checkConflict) {
    const url = `/sap/bc/adt/debugger/breakpoints`;
    const params = {};
    if (checkConflict !== undefined)
        params.checkConflict = checkConflict;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/synchronize',
        },
    });
}
/**
 * Get breakpoint statements
 *
 * @param connection - ABAP connection
 * @returns Axios response with breakpoint statements
 */
async function getBreakpointStatements(connection) {
    const url = `/sap/bc/adt/debugger/breakpoints/statements`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get breakpoint message types
 *
 * @param connection - ABAP connection
 * @returns Axios response with message types
 */
async function getBreakpointMessageTypes(connection) {
    const url = `/sap/bc/adt/debugger/breakpoints/messagetypes`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get breakpoint conditions
 *
 * @param connection - ABAP connection
 * @returns Axios response with breakpoint conditions
 */
async function getBreakpointConditions(connection) {
    const url = `/sap/bc/adt/debugger/breakpoints/conditions`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Validate breakpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with validation results
 */
async function validateBreakpoints(connection) {
    const url = `/sap/bc/adt/debugger/breakpoints/validations`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get VIT breakpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with VIT breakpoints
 */
async function getVitBreakpoints(connection) {
    const url = `/sap/bc/adt/debugger/breakpoints/vit`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Get variable max length
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param part - Variable part
 * @param maxLength - Max length (optional)
 * @returns Axios response with max length
 */
async function getVariableMaxLength(connection, variableName, part, maxLength) {
    if (!variableName || !part) {
        throw new Error('Variable name and part are required');
    }
    const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
    const params = {};
    if (maxLength !== undefined)
        params.maxLength = maxLength;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/maxlength',
        },
    });
}
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
async function getVariableSubcomponents(connection, variableName, part, component, line) {
    if (!variableName || !part) {
        throw new Error('Variable name and part are required');
    }
    const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
    const params = {};
    if (component)
        params.component = component;
    if (line !== undefined)
        params.line = line;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/subcomponents',
        },
    });
}
async function getVariableAsCsv(connection, variableName, part, options) {
    if (!variableName || !part) {
        throw new Error('Variable name and part are required');
    }
    const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
    const params = {};
    if (options?.offset !== undefined)
        params.offset = options.offset;
    if (options?.length !== undefined)
        params.length = options.length;
    if (options?.filter)
        params.filter = options.filter;
    if (options?.sortComponent)
        params.sortComponent = options.sortComponent;
    if (options?.sortDirection)
        params.sortDirection = options.sortDirection;
    if (options?.whereClause)
        params.whereClause = options.whereClause;
    if (options?.c)
        params.c = options.c;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'text/csv',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/csv',
        },
    });
}
async function getVariableAsJson(connection, variableName, part, options) {
    if (!variableName || !part) {
        throw new Error('Variable name and part are required');
    }
    const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
    const params = {};
    if (options?.offset !== undefined)
        params.offset = options.offset;
    if (options?.length !== undefined)
        params.length = options.length;
    if (options?.filter)
        params.filter = options.filter;
    if (options?.sortComponent)
        params.sortComponent = options.sortComponent;
    if (options?.sortDirection)
        params.sortDirection = options.sortDirection;
    if (options?.whereClause)
        params.whereClause = options.whereClause;
    if (options?.c)
        params.c = options.c;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/json',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/json',
        },
    });
}
async function getVariableValueStatement(connection, variableName, part, options) {
    if (!variableName || !part) {
        throw new Error('Variable name and part are required');
    }
    const url = `/sap/bc/adt/debugger/variables/${encodeURIComponent(variableName)}/${encodeURIComponent(part)}`;
    const params = {};
    if (options?.rows !== undefined)
        params.rows = options.rows;
    if (options?.maxStringLength !== undefined)
        params.maxStringLength = options.maxStringLength;
    if (options?.maxNestingLevel !== undefined)
        params.maxNestingLevel = options.maxNestingLevel;
    if (options?.maxTotalSize !== undefined)
        params.maxTotalSize = options.maxTotalSize;
    if (options?.ignoreInitialValues !== undefined)
        params.ignoreInitialValues = options.ignoreInitialValues;
    if (options?.c)
        params.c = options.c;
    if (options?.lineBreakThreshold !== undefined)
        params.lineBreakThreshold = options.lineBreakThreshold;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/valueStatement',
        },
    });
}
/**
 * Execute debugger action
 *
 * @param connection - ABAP connection
 * @param action - Action name
 * @param value - Action value (optional)
 * @returns Axios response
 */
async function executeDebuggerAction(connection, action, value) {
    if (!action) {
        throw new Error('Action is required');
    }
    if (action === 'stepInto' ||
        action === 'stepOut' ||
        action === 'stepContinue') {
        throw new Error(`Debugger action "${action}" must be executed via debugger batch (use stepIntoDebuggerBatch/stepOutDebuggerBatch/stepContinueDebuggerBatch)`);
    }
    const url = `/sap/bc/adt/debugger/actions`;
    const params = { action };
    if (value)
        params.value = value;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/action',
        },
    });
}
/**
 * Get call stack
 *
 * @param connection - ABAP connection
 * @returns Axios response with call stack
 */
async function getCallStack(connection) {
    const url = `/sap/bc/adt/debugger/stack`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Insert watchpoint
 *
 * @param connection - ABAP connection
 * @param variableName - Variable name
 * @param condition - Watchpoint condition (optional)
 * @returns Axios response
 */
async function insertWatchpoint(connection, variableName, condition) {
    if (!variableName) {
        throw new Error('Variable name is required');
    }
    const url = `/sap/bc/adt/debugger/watchpoints`;
    const params = { variableName };
    if (condition)
        params.condition = condition;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/insert',
        },
    });
}
/**
 * Get watchpoints
 *
 * @param connection - ABAP connection
 * @returns Axios response with watchpoints
 */
async function getWatchpoints(connection) {
    const url = `/sap/bc/adt/debugger/watchpoints`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/debugger/relations/get',
        },
    });
}
/**
 * Execute batch request
 *
 * @param connection - ABAP connection
 * @param requests - Batch requests (XML body)
 * @returns Axios response with batch results
 */
async function executeBatchRequest(connection, requests) {
    if (!requests) {
        throw new Error('Requests are required');
    }
    const url = `/sap/bc/adt/debugger/batch`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: requests,
        headers: {
            'Content-Type': 'application/xml',
            Accept: 'application/xml',
        },
    });
}
function buildDebuggerBatchPayload(requests, boundary = (0, buildBatchPayload_1.createBatchBoundary)()) {
    if (!requests.length) {
        throw new Error('At least one batch request is required');
    }
    const parts = requests
        .map((request) => {
        if (!request.trim()) {
            throw new Error('Batch request part must not be empty');
        }
        // Do NOT trim — inner requests must preserve trailing \r\n\r\n
        return [
            `--${boundary}`,
            'Content-Type: application/http',
            'content-transfer-encoding: binary',
            '',
            request,
            '',
        ].join('\r\n');
    })
        .join('');
    return {
        boundary,
        body: `${parts}--${boundary}--\r\n`,
    };
}
function buildDebuggerStepWithStackBatchPayload(stepMethod) {
    const stepRequest = [
        `POST /sap/bc/adt/debugger?method=${stepMethod} HTTP/1.1`,
        `sap-adt-request-id:${(0, buildBatchPayload_1.createRequestId)()}`,
        'Accept:application/xml',
    ].join('\r\n');
    const stackRequest = [
        'POST /sap/bc/adt/debugger?emode=_&semanticURIs=true&method=getStack HTTP/1.1',
        `sap-adt-request-id:${(0, buildBatchPayload_1.createRequestId)()}`,
        'Accept:application/xml',
    ].join('\r\n');
    return buildDebuggerBatchPayload([stepRequest, stackRequest]);
}
async function executeDebuggerStepBatch(connection, stepMethod) {
    const payload = buildDebuggerStepWithStackBatchPayload(stepMethod);
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/debugger/batch',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: payload.body,
        headers: {
            'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
            Accept: 'multipart/mixed',
        },
    });
}
async function stepIntoDebuggerBatch(connection) {
    return executeDebuggerStepBatch(connection, 'stepInto');
}
async function stepOutDebuggerBatch(connection) {
    return executeDebuggerStepBatch(connection, 'stepOut');
}
async function stepContinueDebuggerBatch(connection) {
    return executeDebuggerStepBatch(connection, 'stepContinue');
}
