"use strict";
/**
 * ADT Clients — WebSocket barrel
 * Covers: AdtClientsWS and DebuggerSessionClient.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebuggerSessionClient = exports.AdtClientsWS = void 0;
var AdtClientsWS_1 = require("./clients/AdtClientsWS");
Object.defineProperty(exports, "AdtClientsWS", { enumerable: true, get: function () { return AdtClientsWS_1.AdtClientsWS; } });
var DebuggerSessionClient_1 = require("./clients/DebuggerSessionClient");
Object.defineProperty(exports, "DebuggerSessionClient", { enumerable: true, get: function () { return DebuggerSessionClient_1.DebuggerSessionClient; } });
