"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchRecordingConnection = void 0;
class BatchRecordingConnection {
    realConnection;
    parts = [];
    deferred = [];
    constructor(realConnection) {
        this.realConnection = realConnection;
    }
    async connect() {
        return this.realConnection.connect();
    }
    getBaseUrl() {
        return this.realConnection.getBaseUrl();
    }
    getSessionId() {
        return this.realConnection.getSessionId();
    }
    setSessionType(_type) {
        // no-op — session management is handled by the outer batch request
    }
    makeAdtRequest(options) {
        const part = {
            method: options.method,
            url: options.url,
            headers: options.headers ?? {},
            data: options.data != null ? String(options.data) : undefined,
            params: options.params != null
                ? options.params
                : undefined,
        };
        this.parts.push(part);
        const promise = new Promise((resolve, reject) => {
            this.deferred.push({
                resolve: resolve,
                reject,
            });
        });
        return promise;
    }
    getRecordedParts() {
        return [...this.parts];
    }
    resolveAll(responses) {
        if (responses.length !== this.deferred.length) {
            const error = new Error(`Batch response count (${responses.length}) does not match recorded request count (${this.deferred.length})`);
            for (const d of this.deferred) {
                d.reject(error);
            }
            this.reset();
            return;
        }
        for (let i = 0; i < responses.length; i++) {
            const resp = responses[i];
            const d = this.deferred[i];
            if (resp.status >= 400) {
                d.reject(new Error(`Batch part ${i} failed: ${resp.status} ${resp.statusText}`));
            }
            else {
                d.resolve({
                    data: resp.data,
                    status: resp.status,
                    statusText: resp.statusText,
                    headers: resp.headers,
                });
            }
        }
        this.reset();
    }
    reset() {
        this.parts = [];
        this.deferred = [];
    }
    getRealConnection() {
        return this.realConnection;
    }
}
exports.BatchRecordingConnection = BatchRecordingConnection;
