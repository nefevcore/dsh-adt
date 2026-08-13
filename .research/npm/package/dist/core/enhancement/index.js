"use strict";
/**
 * Enhancement module exports
 *
 * Provides CRUD operations for SAP Enhancement objects:
 * - Enhancement Implementation (ENHO)
 * - BAdI Implementation
 * - Source Code Plugin (with source code)
 * - Enhancement Spot (ENHS)
 * - BAdI Enhancement Spot
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnhancementName = exports.validate = exports.updateEnhancement = exports.update = exports.unlockEnhancement = exports.supportsSourceCode = exports.isSpotType = exports.isImplementationType = exports.getEnhancementUri = exports.getEnhancementBaseUrl = exports.ENHANCEMENT_TYPE_CODES = exports.getEnhancementTransport = exports.getEnhancementSource = exports.getEnhancementMetadata = exports.lockEnhancementForUpdate = exports.lockEnhancement = exports.deleteEnhancement = exports.checkDeletion = exports.create = exports.checkEnhancement = exports.check = exports.activateEnhancement = exports.AdtEnhancement = void 0;
// High-level AdtObject implementation
var AdtEnhancement_1 = require("./AdtEnhancement");
Object.defineProperty(exports, "AdtEnhancement", { enumerable: true, get: function () { return AdtEnhancement_1.AdtEnhancement; } });
var activation_1 = require("./activation");
Object.defineProperty(exports, "activateEnhancement", { enumerable: true, get: function () { return activation_1.activateEnhancement; } });
var check_1 = require("./check");
Object.defineProperty(exports, "check", { enumerable: true, get: function () { return check_1.check; } });
Object.defineProperty(exports, "checkEnhancement", { enumerable: true, get: function () { return check_1.checkEnhancement; } });
// Low-level functions
var create_1 = require("./create");
Object.defineProperty(exports, "create", { enumerable: true, get: function () { return create_1.create; } });
var delete_1 = require("./delete");
Object.defineProperty(exports, "checkDeletion", { enumerable: true, get: function () { return delete_1.checkDeletion; } });
Object.defineProperty(exports, "deleteEnhancement", { enumerable: true, get: function () { return delete_1.deleteEnhancement; } });
var lock_1 = require("./lock");
Object.defineProperty(exports, "lockEnhancement", { enumerable: true, get: function () { return lock_1.lockEnhancement; } });
Object.defineProperty(exports, "lockEnhancementForUpdate", { enumerable: true, get: function () { return lock_1.lockEnhancementForUpdate; } });
var read_1 = require("./read");
Object.defineProperty(exports, "getEnhancementMetadata", { enumerable: true, get: function () { return read_1.getEnhancementMetadata; } });
Object.defineProperty(exports, "getEnhancementSource", { enumerable: true, get: function () { return read_1.getEnhancementSource; } });
Object.defineProperty(exports, "getEnhancementTransport", { enumerable: true, get: function () { return read_1.getEnhancementTransport; } });
var types_1 = require("./types");
Object.defineProperty(exports, "ENHANCEMENT_TYPE_CODES", { enumerable: true, get: function () { return types_1.ENHANCEMENT_TYPE_CODES; } });
Object.defineProperty(exports, "getEnhancementBaseUrl", { enumerable: true, get: function () { return types_1.getEnhancementBaseUrl; } });
Object.defineProperty(exports, "getEnhancementUri", { enumerable: true, get: function () { return types_1.getEnhancementUri; } });
Object.defineProperty(exports, "isImplementationType", { enumerable: true, get: function () { return types_1.isImplementationType; } });
Object.defineProperty(exports, "isSpotType", { enumerable: true, get: function () { return types_1.isSpotType; } });
Object.defineProperty(exports, "supportsSourceCode", { enumerable: true, get: function () { return types_1.supportsSourceCode; } });
var unlock_1 = require("./unlock");
Object.defineProperty(exports, "unlockEnhancement", { enumerable: true, get: function () { return unlock_1.unlockEnhancement; } });
var update_1 = require("./update");
Object.defineProperty(exports, "update", { enumerable: true, get: function () { return update_1.update; } });
Object.defineProperty(exports, "updateEnhancement", { enumerable: true, get: function () { return update_1.updateEnhancement; } });
var validation_1 = require("./validation");
Object.defineProperty(exports, "validate", { enumerable: true, get: function () { return validation_1.validate; } });
Object.defineProperty(exports, "validateEnhancementName", { enumerable: true, get: function () { return validation_1.validateEnhancementName; } });
