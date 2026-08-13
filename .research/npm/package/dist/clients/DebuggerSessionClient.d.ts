import type { AdtClientsWS } from './AdtClientsWS';
export type DebuggerStepAction = 'step_over' | 'step_into' | 'step_return' | 'continue';
export interface IDebuggerListenParams {
    timeoutSeconds?: number;
    user?: string;
}
export interface IDebuggerAttachParams {
    sessionId: string;
}
export interface IDebuggerStepParams {
    action: DebuggerStepAction;
    value?: string;
}
export interface IDebuggerGetVariablesParams {
    frameId?: string;
    filter?: string;
}
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
export declare class DebuggerSessionClient {
    private readonly wsClient;
    constructor(wsClient: AdtClientsWS);
    listen<TResponse = unknown>(params?: IDebuggerListenParams): Promise<TResponse>;
    attach<TResponse = unknown>(params: IDebuggerAttachParams): Promise<TResponse>;
    detach<TResponse = unknown>(): Promise<TResponse>;
    step<TResponse = unknown>(params: IDebuggerStepParams): Promise<TResponse>;
    getStack<TResponse = unknown>(): Promise<TResponse>;
    getVariables<TResponse = unknown>(params?: IDebuggerGetVariablesParams): Promise<TResponse>;
}
//# sourceMappingURL=DebuggerSessionClient.d.ts.map