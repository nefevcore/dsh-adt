"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwUnsupportedOperation = throwUnsupportedOperation;
const interfaces_1 = require("@mcp-abap-adt/interfaces");
/** Throw a typed "operation not supported for this object type" error. */
function throwUnsupportedOperation(operation, detail) {
    const e = new interfaces_1.AdtOperationError(`Operation "${operation}" is not supported${detail ? ` for ${detail}` : ''}`);
    e.code = interfaces_1.AdtObjectErrorCodes.UNSUPPORTED_OPERATION;
    throw e;
}
