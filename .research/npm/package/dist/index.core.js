"use strict";
/**
 * ADT Clients — core barrel
 * Covers: AdtClient, AdtClientLegacy, createAdtClient, all core/** object types,
 * core/shared utilities, and the @mcp-abap-adt/interfaces re-export block (back-compat).
 * Ambiguous utils (discoveryEndpoints, systemInfo) are placed here per the "ambiguous → core" rule.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContentTypes = exports.isModernAdtSystem = exports.getSystemInformation = exports.isEndpointInDiscovery = exports.fetchDiscoveryEndpoints = exports.AdtContentTypesModern = exports.AdtContentTypesBase = exports.parseSearchResults = exports.resolveBindingVariant = exports.AdtServiceBinding = exports.AdtService = exports.AdtScalarFunctionImplementation = exports.AdtScalarFunction = exports.AdtMessageClassMessage = exports.AdtMessageClass = exports.AdtAppendStructure = exports.createAdtClient = exports.AdtClientLegacy = exports.AdtClient = void 0;
var AdtClient_1 = require("./clients/AdtClient");
Object.defineProperty(exports, "AdtClient", { enumerable: true, get: function () { return AdtClient_1.AdtClient; } });
var AdtClientLegacy_1 = require("./clients/AdtClientLegacy");
Object.defineProperty(exports, "AdtClientLegacy", { enumerable: true, get: function () { return AdtClientLegacy_1.AdtClientLegacy; } });
var createAdtClient_1 = require("./clients/createAdtClient");
Object.defineProperty(exports, "createAdtClient", { enumerable: true, get: function () { return createAdtClient_1.createAdtClient; } });
var appendStructure_1 = require("./core/appendStructure");
Object.defineProperty(exports, "AdtAppendStructure", { enumerable: true, get: function () { return appendStructure_1.AdtAppendStructure; } });
var messageClass_1 = require("./core/messageClass");
Object.defineProperty(exports, "AdtMessageClass", { enumerable: true, get: function () { return messageClass_1.AdtMessageClass; } });
Object.defineProperty(exports, "AdtMessageClassMessage", { enumerable: true, get: function () { return messageClass_1.AdtMessageClassMessage; } });
var scalarFunction_1 = require("./core/scalarFunction");
Object.defineProperty(exports, "AdtScalarFunction", { enumerable: true, get: function () { return scalarFunction_1.AdtScalarFunction; } });
var scalarFunctionImplementation_1 = require("./core/scalarFunctionImplementation");
Object.defineProperty(exports, "AdtScalarFunctionImplementation", { enumerable: true, get: function () { return scalarFunctionImplementation_1.AdtScalarFunctionImplementation; } });
var service_1 = require("./core/service");
Object.defineProperty(exports, "AdtService", { enumerable: true, get: function () { return service_1.AdtService; } });
Object.defineProperty(exports, "AdtServiceBinding", { enumerable: true, get: function () { return service_1.AdtServiceBinding; } });
Object.defineProperty(exports, "resolveBindingVariant", { enumerable: true, get: function () { return service_1.resolveBindingVariant; } });
var shared_1 = require("./core/shared");
Object.defineProperty(exports, "parseSearchResults", { enumerable: true, get: function () { return shared_1.parseSearchResults; } });
var contentTypes_1 = require("./core/shared/contentTypes");
Object.defineProperty(exports, "AdtContentTypesBase", { enumerable: true, get: function () { return contentTypes_1.AdtContentTypesBase; } });
Object.defineProperty(exports, "AdtContentTypesModern", { enumerable: true, get: function () { return contentTypes_1.AdtContentTypesModern; } });
var discoveryEndpoints_1 = require("./utils/discoveryEndpoints");
Object.defineProperty(exports, "fetchDiscoveryEndpoints", { enumerable: true, get: function () { return discoveryEndpoints_1.fetchDiscoveryEndpoints; } });
Object.defineProperty(exports, "isEndpointInDiscovery", { enumerable: true, get: function () { return discoveryEndpoints_1.isEndpointInDiscovery; } });
var systemInfo_1 = require("./utils/systemInfo");
Object.defineProperty(exports, "getSystemInformation", { enumerable: true, get: function () { return systemInfo_1.getSystemInformation; } });
Object.defineProperty(exports, "isModernAdtSystem", { enumerable: true, get: function () { return systemInfo_1.isModernAdtSystem; } });
Object.defineProperty(exports, "resolveContentTypes", { enumerable: true, get: function () { return systemInfo_1.resolveContentTypes; } });
