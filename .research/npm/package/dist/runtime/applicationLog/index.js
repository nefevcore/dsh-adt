"use strict";
/**
 * Application Log - Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApplicationLogName = exports.getApplicationLogSource = exports.getApplicationLogObject = exports.ApplicationLog = void 0;
var ApplicationLog_1 = require("./ApplicationLog");
Object.defineProperty(exports, "ApplicationLog", { enumerable: true, get: function () { return ApplicationLog_1.ApplicationLog; } });
var read_1 = require("./read");
Object.defineProperty(exports, "getApplicationLogObject", { enumerable: true, get: function () { return read_1.getApplicationLogObject; } });
Object.defineProperty(exports, "getApplicationLogSource", { enumerable: true, get: function () { return read_1.getApplicationLogSource; } });
Object.defineProperty(exports, "validateApplicationLogName", { enumerable: true, get: function () { return read_1.validateApplicationLogName; } });
