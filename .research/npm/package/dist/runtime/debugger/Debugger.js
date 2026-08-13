"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Debugger = void 0;
const MemorySnapshots_1 = require("../memory/MemorySnapshots");
const AbapDebugger_1 = require("./AbapDebugger");
const AmdpDebugger_1 = require("./AmdpDebugger");
class Debugger {
    connection;
    logger;
    kind = 'debugger';
    _abap;
    _amdp;
    _memorySnapshots;
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    getAbap() {
        if (!this._abap) {
            this._abap = new AbapDebugger_1.AbapDebugger(this.connection, this.logger);
        }
        return this._abap;
    }
    getAmdp() {
        if (!this._amdp) {
            this._amdp = new AmdpDebugger_1.AmdpDebugger(this.connection, this.logger);
        }
        return this._amdp;
    }
    getMemorySnapshots() {
        if (!this._memorySnapshots) {
            this._memorySnapshots = new MemorySnapshots_1.MemorySnapshots(this.connection, this.logger);
        }
        return this._memorySnapshots;
    }
}
exports.Debugger = Debugger;
