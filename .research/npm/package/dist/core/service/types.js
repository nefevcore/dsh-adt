"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_BINDING_VARIANT_MAP = void 0;
exports.resolveBindingVariant = resolveBindingVariant;
const interfaces_1 = require("@mcp-abap-adt/interfaces");
var interfaces_2 = require("@mcp-abap-adt/interfaces");
Object.defineProperty(exports, "SERVICE_BINDING_VARIANT_MAP", { enumerable: true, get: function () { return interfaces_2.SERVICE_BINDING_VARIANT_MAP; } });
function resolveBindingVariant(variant) {
    return interfaces_1.SERVICE_BINDING_VARIANT_MAP[variant];
}
