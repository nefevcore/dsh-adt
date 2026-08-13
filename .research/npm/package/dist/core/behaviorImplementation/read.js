"use strict";
/**
 * Behavior Implementation read operations
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBehaviorImplementationMetadata = getBehaviorImplementationMetadata;
exports.getBehaviorImplementationSource = getBehaviorImplementationSource;
exports.getBehaviorImplementationImplementations = getBehaviorImplementationImplementations;
exports.getBehaviorImplementationTransport = getBehaviorImplementationTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const noopLogger_1 = require("../../utils/noopLogger");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection, logger) {
    return new AdtUtils_1.AdtUtils(connection, logger ?? noopLogger_1.noopLogger);
}
/**
 * Get behavior implementation class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 */
async function getBehaviorImplementationMetadata(connection, className, options, logger) {
    return getUtils(connection, logger).readObjectMetadata('class', className, undefined, options);
}
/**
 * Get behavior implementation class source code (main)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getBehaviorImplementationSource(connection, className, version, options, logger) {
    return getUtils(connection, logger).readObjectSource('class', className, undefined, version, options);
}
/**
 * Get behavior implementation class implementations include source code
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getBehaviorImplementationImplementations(connection, className, version = 'active', options, logger) {
    const { encodeSapObjectName } = await Promise.resolve().then(() => __importStar(require('../../utils/internalUtils')));
    const { getTimeout } = await Promise.resolve().then(() => __importStar(require('../../utils/timeouts')));
    const encodedName = encodeSapObjectName(className).toLowerCase();
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations${version !== 'active' ? `?version=${version}` : ''}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: getTimeout('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
        },
    }, { logger });
}
/**
 * Get transport request for ABAP behavior implementation class
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @returns Transport request information
 */
async function getBehaviorImplementationTransport(connection, className, options) {
    // Behavior implementation is a class, so use class transport endpoint
    const { getClassTransport } = await Promise.resolve().then(() => __importStar(require('../class/read')));
    return getClassTransport(connection, className, options);
}
