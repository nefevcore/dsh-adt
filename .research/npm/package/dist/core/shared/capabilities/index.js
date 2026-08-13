"use strict";
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
exports.VersionsCapability = exports.LockCapability = void 0;
var LockCapability_1 = require("./LockCapability");
Object.defineProperty(exports, "LockCapability", { enumerable: true, get: function () { return LockCapability_1.LockCapability; } });
__exportStar(require("./types"), exports);
var VersionsCapability_1 = require("./VersionsCapability");
Object.defineProperty(exports, "VersionsCapability", { enumerable: true, get: function () { return VersionsCapability_1.VersionsCapability; } });
