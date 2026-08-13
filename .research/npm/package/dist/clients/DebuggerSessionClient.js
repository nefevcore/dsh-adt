"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebuggerSessionClient = void 0;
/**
 * Thin high-level facade for debugger session lifecycle over AdtClientsWS.
 *
 * Operation names are transport-agnostic contracts for the WS backend:
 * - debugger.listen
 * - debugger.attach
 * - debugger.detach
 * - debugger.step
 * - debugger.getStack
 * - debugger.getVariables
 */
class DebuggerSessionClient {
    wsClient;
    constructor(wsClient) {
        this.wsClient = wsClient;
    }
    async listen(params) {
        return this.wsClient.request('debugger.listen', params);
    }
    async attach(params) {
        return this.wsClient.request('debugger.attach', params);
    }
    async detach() {
        return this.wsClient.request('debugger.detach');
    }
    async step(params) {
        return this.wsClient.request('debugger.step', params);
    }
    async getStack() {
        return this.wsClient.request('debugger.getStack');
    }
    async getVariables(params) {
        return this.wsClient.request('debugger.getVariables', params);
    }
}
exports.DebuggerSessionClient = DebuggerSessionClient;
