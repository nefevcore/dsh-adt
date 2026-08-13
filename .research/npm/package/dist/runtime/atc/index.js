"use strict";
/**
 * ATC (ABAP Test Cockpit) - Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExecutionLog = exports.getCheckFailureLogs = exports.AtcLog = void 0;
var AtcLog_1 = require("./AtcLog");
Object.defineProperty(exports, "AtcLog", { enumerable: true, get: function () { return AtcLog_1.AtcLog; } });
var logs_1 = require("./logs");
Object.defineProperty(exports, "getCheckFailureLogs", { enumerable: true, get: function () { return logs_1.getCheckFailureLogs; } });
Object.defineProperty(exports, "getExecutionLog", { enumerable: true, get: function () { return logs_1.getExecutionLog; } });
