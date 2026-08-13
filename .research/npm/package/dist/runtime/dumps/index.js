"use strict";
/**
 * Runtime Dumps - Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRuntimeDumpsByUser = exports.listRuntimeDumps = exports.getRuntimeDumpById = exports.buildRuntimeDumpsUserQuery = exports.buildDumpIdPrefix = exports.RuntimeDumps = void 0;
var RuntimeDumps_1 = require("./RuntimeDumps");
Object.defineProperty(exports, "RuntimeDumps", { enumerable: true, get: function () { return RuntimeDumps_1.RuntimeDumps; } });
var read_1 = require("./read");
Object.defineProperty(exports, "buildDumpIdPrefix", { enumerable: true, get: function () { return read_1.buildDumpIdPrefix; } });
Object.defineProperty(exports, "buildRuntimeDumpsUserQuery", { enumerable: true, get: function () { return read_1.buildRuntimeDumpsUserQuery; } });
Object.defineProperty(exports, "getRuntimeDumpById", { enumerable: true, get: function () { return read_1.getRuntimeDumpById; } });
Object.defineProperty(exports, "listRuntimeDumps", { enumerable: true, get: function () { return read_1.listRuntimeDumps; } });
Object.defineProperty(exports, "listRuntimeDumpsByUser", { enumerable: true, get: function () { return read_1.listRuntimeDumpsByUser; } });
