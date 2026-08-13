import type { ILogger, IWebSocketConnectOptions, IWebSocketMessageHandler, IWebSocketTransport } from '@mcp-abap-adt/interfaces';
import { DebuggerSessionClient } from './DebuggerSessionClient';
export interface IAdtClientsWSRequestOptions {
    correlationId?: string;
    timeoutMs?: number;
}
export interface IAdtClientsWSOptions {
    requestTimeoutMs?: number;
}
export declare class AdtClientsWS {
    private readonly transport;
    private readonly logger;
    private readonly requestTimeoutMs;
    private readonly pending;
    private readonly eventHandlers;
    constructor(transport: IWebSocketTransport, logger?: ILogger, options?: IAdtClientsWSOptions);
    connect(url: string, options?: IWebSocketConnectOptions): Promise<void>;
    disconnect(code?: number, reason?: string): Promise<void>;
    isConnected(): boolean;
    onEvent(handler: IWebSocketMessageHandler<unknown>): void;
    getDebuggerSessionClient(): DebuggerSessionClient;
    request<TPayload = unknown, TResponse = unknown>(operation: string, payload?: TPayload, options?: IAdtClientsWSRequestOptions): Promise<TResponse>;
    sendEvent<TPayload = unknown>(operation: string, payload?: TPayload): Promise<void>;
    private handleMessage;
}
//# sourceMappingURL=AdtClientsWS.d.ts.map