"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtClientBatch = void 0;
const AdtClient_1 = require("../clients/AdtClient");
const BatchRecordingConnection_1 = require("./BatchRecordingConnection");
const buildBatchPayload_1 = require("./buildBatchPayload");
const parseBatchResponse_1 = require("./parseBatchResponse");
class AdtClientBatch {
    recorder;
    innerClient;
    realConnection;
    constructor(connection, logger, options) {
        this.realConnection = connection;
        this.recorder = new BatchRecordingConnection_1.BatchRecordingConnection(connection);
        this.innerClient = new AdtClient_1.AdtClient(this.recorder, logger, options);
    }
    // Mirror all AdtClient factory methods
    getClass() {
        return this.innerClient.getClass();
    }
    getProgram() {
        return this.innerClient.getProgram();
    }
    getInterface() {
        return this.innerClient.getInterface();
    }
    getDomain() {
        return this.innerClient.getDomain();
    }
    getDataElement() {
        return this.innerClient.getDataElement();
    }
    getStructure() {
        return this.innerClient.getStructure();
    }
    getTable() {
        return this.innerClient.getTable();
    }
    getTableType() {
        return this.innerClient.getTableType();
    }
    getDdl() {
        return this.innerClient.getDdl();
    }
    getFunctionGroup() {
        return this.innerClient.getFunctionGroup();
    }
    getFunctionModule() {
        return this.innerClient.getFunctionModule();
    }
    getPackage() {
        return this.innerClient.getPackage();
    }
    getServiceDefinition() {
        return this.innerClient.getServiceDefinition();
    }
    getScalarFunction() {
        return this.innerClient.getScalarFunction();
    }
    getScalarFunctionImplementation() {
        return this.innerClient.getScalarFunctionImplementation();
    }
    getAppendStructure() {
        return this.innerClient.getAppendStructure();
    }
    getServiceBinding() {
        return this.innerClient.getServiceBinding();
    }
    getService() {
        return this.innerClient.getService();
    }
    getBehaviorDefinition() {
        return this.innerClient.getBehaviorDefinition();
    }
    getBehaviorImplementation() {
        return this.innerClient.getBehaviorImplementation();
    }
    getMetadataExtension() {
        return this.innerClient.getMetadataExtension();
    }
    getEnhancement() {
        return this.innerClient.getEnhancement();
    }
    getUnitTest() {
        return this.innerClient.getUnitTest();
    }
    getCdsUnitTest() {
        return this.innerClient.getCdsUnitTest();
    }
    getRequest() {
        return this.innerClient.getRequest();
    }
    getUtils() {
        return this.innerClient.getUtils();
    }
    getLocalTestClass() {
        return this.innerClient.getLocalTestClass();
    }
    getLocalTypes() {
        return this.innerClient.getLocalTypes();
    }
    getLocalDefinitions() {
        return this.innerClient.getLocalDefinitions();
    }
    getLocalMacros() {
        return this.innerClient.getLocalMacros();
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
exports.AdtClientBatch = AdtClientBatch;
