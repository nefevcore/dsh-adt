"use strict";
/**
 * Shared operations - cross-cutting ADT functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransaction = exports.parseSearchResults = exports.UnsupportedValidateOperationError = exports.UnsupportedUpdateOperationError = exports.UnsupportedDeleteOperationError = exports.UnsupportedCreateOperationError = exports.UnsupportedCheckOperationError = exports.UnsupportedAdtOperationError = exports.UnsupportedActivateOperationError = exports.AdtUtils = void 0;
var AdtUtils_1 = require("./AdtUtils");
Object.defineProperty(exports, "AdtUtils", { enumerable: true, get: function () { return AdtUtils_1.AdtUtils; } });
// Error classes for unsupported operations
var errors_1 = require("./errors");
Object.defineProperty(exports, "UnsupportedActivateOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedActivateOperationError; } });
Object.defineProperty(exports, "UnsupportedAdtOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedAdtOperationError; } });
Object.defineProperty(exports, "UnsupportedCheckOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedCheckOperationError; } });
Object.defineProperty(exports, "UnsupportedCreateOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedCreateOperationError; } });
Object.defineProperty(exports, "UnsupportedDeleteOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedDeleteOperationError; } });
Object.defineProperty(exports, "UnsupportedUpdateOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedUpdateOperationError; } });
Object.defineProperty(exports, "UnsupportedValidateOperationError", { enumerable: true, get: function () { return errors_1.UnsupportedValidateOperationError; } });
/**
 * Parsing a quickSearch payload the caller already holds.
 *
 * Exported because there is no other route to it: unlike the operations above,
 * it needs no connection, so `AdtClient.getUtils()` is not a path to it. A
 * caller that fetched the XML by other means — a batch response, a cached
 * document — would otherwise have to reach in past the package boundary.
 */
var search_1 = require("./search");
Object.defineProperty(exports, "parseSearchResults", { enumerable: true, get: function () { return search_1.parseSearchResults; } });
var transaction_1 = require("./transaction");
Object.defineProperty(exports, "getTransaction", { enumerable: true, get: function () { return transaction_1.getTransaction; } });
