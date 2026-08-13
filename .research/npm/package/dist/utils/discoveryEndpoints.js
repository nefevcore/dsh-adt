"use strict";
/**
 * Discovery-based endpoint availability checking
 *
 * Utilities for parsing /sap/bc/adt/discovery and determining
 * which ADT endpoints a system supports.
 *
 * The main library uses isModernAdtSystem() to auto-detect and
 * AdtClientLegacy has hardcoded stubs for known-unsupported types.
 * These utilities are for consumers who want manual checking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDiscoveryEndpoints = fetchDiscoveryEndpoints;
exports.isEndpointInDiscovery = isEndpointInDiscovery;
const contentTypes_1 = require("../constants/contentTypes");
const timeouts_1 = require("./timeouts");
/**
 * Fetch /sap/bc/adt/discovery and extract all collection href paths.
 *
 * @returns Set of endpoint paths available on the system
 */
async function fetchDiscoveryEndpoints(connection) {
    const endpoints = new Set();
    try {
        const response = await connection.makeAdtRequest({
            url: '/sap/bc/adt/discovery',
            method: 'GET',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: contentTypes_1.ACCEPT_DISCOVERY,
            },
        });
        const xml = typeof response.data === 'string' ? response.data : '';
        // Extract all href values from app:collection elements
        const hrefRegex = /href="([^"]+)"/g;
        let match = hrefRegex.exec(xml);
        while (match !== null) {
            const href = match[1];
            // Only include relative paths (skip absolute URLs like http://...)
            if (href.startsWith('/')) {
                endpoints.add(href);
            }
            match = hrefRegex.exec(xml);
        }
    }
    catch {
        // If discovery fails, return empty set — caller decides what to do
    }
    return endpoints;
}
/**
 * Check if a specific endpoint path is available in the discovery set.
 * Supports prefix matching — e.g., '/sap/bc/adt/ddic/domains' matches
 * if the discovery contains '/sap/bc/adt/ddic/domains' or any sub-path.
 */
function isEndpointInDiscovery(endpoints, path) {
    if (endpoints.has(path))
        return true;
    for (const ep of endpoints) {
        if (ep.startsWith(path))
            return true;
    }
    return false;
}
