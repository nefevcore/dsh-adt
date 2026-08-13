"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtRuntimeClientBatch = void 0;
const AdtRuntimeClient_1 = require("../clients/AdtRuntimeClient");
const BatchRecordingConnection_1 = require("./BatchRecordingConnection");
const buildBatchPayload_1 = require("./buildBatchPayload");
const parseBatchResponse_1 = require("./parseBatchResponse");
class AdtRuntimeClientBatch {
    recorder;
    innerRuntime;
    realConnection;
    constructor(connection, logger) {
        this.realConnection = connection;
        this.recorder = new BatchRecordingConnection_1.BatchRecordingConnection(connection);
        this.innerRuntime = new AdtRuntimeClient_1.AdtRuntimeClient(this.recorder, logger);
    }
    // Mirror relevant AdtRuntimeClient methods — consumers use the inner client
    // for recording, then call batchExecute() to flush.
    getInnerClient() {
        return this.innerRuntime;
    }
    async batchExecute() {
        const parts = this.recorder.getRecordedParts();
        if (parts.length === 0) {
            return [];
        }
        const payload = (0, buildBatchPayload_1.buildBatchPayload)(parts);
        const response = await this.realConnection.makeAdtRequest({
            url: '/sap/bc/adt/debugger/batch',
            method: 'POST',
            timeout: 30000,
            data: payload.body,
            headers: {
                'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
                Accept: 'multipart/mixed',
            },
        });
        const contentType = String(response.headers?.['content-type'] ?? '');
        const parsed = (0, parseBatchResponse_1.parseBatchResponse)(String(response.data), contentType);
        this.recorder.resolveAll(parsed);
        return parsed.map((p) => ({
            data: p.data,
            status: p.status,
            statusText: p.statusText,
            headers: p.headers,
        }));
    }
    reset() {
        this.recorder.reset();
    }
    getRecorder() {
        return this.recorder;
    }
}
exports.AdtRuntimeClientBatch = AdtRuntimeClientBatch;
