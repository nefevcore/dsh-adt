"use strict";
/**
 * ADT Clients — batch barrel
 * Covers: all batch/** modules (AdtClientBatch, AdtRuntimeClientBatch, BatchRecordingConnection).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchRecordingConnection = exports.AdtRuntimeClientBatch = exports.AdtClientBatch = void 0;
var AdtClientBatch_1 = require("./batch/AdtClientBatch");
Object.defineProperty(exports, "AdtClientBatch", { enumerable: true, get: function () { return AdtClientBatch_1.AdtClientBatch; } });
var AdtRuntimeClientBatch_1 = require("./batch/AdtRuntimeClientBatch");
Object.defineProperty(exports, "AdtRuntimeClientBatch", { enumerable: true, get: function () { return AdtRuntimeClientBatch_1.AdtRuntimeClientBatch; } });
var BatchRecordingConnection_1 = require("./batch/BatchRecordingConnection");
Object.defineProperty(exports, "BatchRecordingConnection", { enumerable: true, get: function () { return BatchRecordingConnection_1.BatchRecordingConnection; } });
