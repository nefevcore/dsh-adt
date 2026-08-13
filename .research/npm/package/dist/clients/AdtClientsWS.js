"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtClientsWS = void 0;
const node_crypto_1 = require("node:crypto");
const DebuggerSessionClient_1 = require("./DebuggerSessionClient");
class AdtClientsWS {
    transport;
    logger;
    requestTimeoutMs;
    pending = new Map();
    eventHandlers = [];
    constructor(transport, logger, options) {
        this.transport = transport;
        this.logger = logger ?? {
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
        };
        this.requestTimeoutMs = options?.requestTimeoutMs ?? 30_000;
        this.transport.onMessage((message) => this.handleMessage(message));
    }
    async connect(url, options) {
        await this.transport.connect(url, options);
        this.logger.debug('AdtClientsWS connected', { url });
    }
    async disconnect(code, reason) {
        await this.transport.disconnect(code, reason);
        this.logger.debug('AdtClientsWS disconnected', { code, reason });
    }
    isConnected() {
        return this.transport.isConnected();
    }
    onEvent(handler) {
        this.eventHandlers.push(handler);
    }
    getDebuggerSessionClient() {
        return new DebuggerSessionClient_1.DebuggerSessionClient(this);
    }
    async request(operation, payload, options) {
        const correlationId = options?.correlationId ?? (0, node_crypto_1.randomUUID)();
        const timeoutMs = options?.timeoutMs ?? this.requestTimeoutMs;
        return new Promise((resolve, reject) => {
            const resolveTyped = (value) => resolve(value);
            const timeout = setTimeout(() => {
                this.pending.delete(correlationId);
                reject(new Error(`AdtClientsWS request timeout for operation "${operation}" after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(correlationId, {
                resolve: resolveTyped,
                reject,
                timeout,
            });
            const message = {
                kind: 'request',
                operation,
                correlationId,
                payload,
                timestamp: Date.now(),
            };
            this.transport.send(message).catch((error) => {
                clearTimeout(timeout);
                this.pending.delete(correlationId);
                reject(error instanceof Error ? error : new Error(String(error)));
            });
        });
    }
    async sendEvent(operation, payload) {
        const message = {
            kind: 'event',
            operation,
            payload,
            timestamp: Date.now(),
        };
        await this.transport.send(message);
    }
    async handleMessage(message) {
        const correlationId = message.correlationId;
        if (correlationId && this.pending.has(correlationId)) {
            const request = this.pending.get(correlationId);
            if (!request) {
                return;
            }
            clearTimeout(request.timeout);
            this.pending.delete(correlationId);
            if (message.kind === 'error') {
                const payloadMessage = typeof message.payload === 'string'
                    ? message.payload
                    : JSON.stringify(message.payload || {});
                request.reject(new Error(`AdtClientsWS request failed for correlationId "${correlationId}": ${payloadMessage}`));
                return;
            }
            request.resolve(message.payload);
            return;
        }
        for (const handler of this.eventHandlers) {
            await handler(message);
        }
    }
}
exports.AdtClientsWS = AdtClientsWS;
