"use strict";
/**
 * Program operations - exports
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProgram = exports.AdtProgram = void 0;
var AdtProgram_1 = require("./AdtProgram");
Object.defineProperty(exports, "AdtProgram", { enumerable: true, get: function () { return AdtProgram_1.AdtProgram; } });
var run_1 = require("./run");
Object.defineProperty(exports, "runProgram", { enumerable: true, get: function () { return run_1.runProgram; } });
__exportStar(require("./types"), exports);
