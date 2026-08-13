"use strict";
/**
 * GatewayErrorLog Module - Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGatewayErrors = exports.getGatewayError = exports.GatewayErrorLog = void 0;
var GatewayErrorLog_1 = require("./GatewayErrorLog");
Object.defineProperty(exports, "GatewayErrorLog", { enumerable: true, get: function () { return GatewayErrorLog_1.GatewayErrorLog; } });
var read_1 = require("./read");
Object.defineProperty(exports, "getGatewayError", { enumerable: true, get: function () { return read_1.getGatewayError; } });
Object.defineProperty(exports, "listGatewayErrors", { enumerable: true, get: function () { return read_1.listGatewayErrors; } });
