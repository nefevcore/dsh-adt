"use strict";
/**
 * Package validation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePackageBasic = validatePackageBasic;
exports.validatePackageFull = validatePackageFull;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Step 1: Validate package parameters (basic check)
 * Returns raw response from ADT - consumer decides how to interpret it
 */
async function validatePackageBasic(connection, args) {
    const qs = (0, internalUtils_1.buildQueryString)({
        objname: args.package_name,
        packagename: args.super_package,
        description: args.description || args.package_name,
        packagetype: args.package_type || 'development',
        checkmode: 'basic',
    });
    const url = `/sap/bc/adt/packages/validation?${qs}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_VALIDATION,
        },
    });
}
/**
 * Step 3: Full validation with transport layer
 * Returns raw response from ADT - consumer decides how to interpret it
 */
async function validatePackageFull(connection, args, swcomp, transportLayer) {
    const qs = (0, internalUtils_1.buildQueryString)({
        objname: args.package_name,
        packagename: args.super_package,
        description: args.description || args.package_name,
        packagetype: args.package_type || 'development',
        swcomp: swcomp,
        transportlayer: transportLayer,
        recordChanges: 'false',
        checkmode: 'full',
    });
    const url = `/sap/bc/adt/packages/validation?${qs}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_VALIDATION,
        },
    });
}
