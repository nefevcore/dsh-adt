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
exports.activateObjectsGroup = activateObjectsGroup;
exports.parseActivationResponse = parseActivationResponse;
exports.checkObject = checkObject;
const timeouts_1 = require("./timeouts");
/**
 * Internal helper to make ADT request
 */
async function makeAdtRequest(connection, url, method = 'GET', timeout = 'default', data, params, headers) {
    const timeoutValue = (0, timeouts_1.getTimeout)(timeout);
    return connection.makeAdtRequest({
        url,
        method,
        timeout: timeoutValue,
        data,
        params,
        headers,
    });
}
/**
 * Get base URL from connection
 */
/**
 * Activate multiple ABAP objects in batch
 * Uses ADT activation/runs endpoint for batch activation
 */
async function activateObjectsGroup(connection, objects, preaudit = true) {
    const url = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preaudit}`;
    const objectReferences = objects
        .map((obj) => `  <adtcore:objectReference adtcore:uri="${obj.uri}" adtcore:name="${obj.name}"/>`)
        .join('\n');
    const activationXml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;
    const headers = {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
    };
    return makeAdtRequest(connection, url, 'POST', 'default', activationXml, undefined, headers);
}
/**
 * Parse activation response to extract status and messages
 */
function parseActivationResponse(responseData) {
    const { XMLParser } = require('fast-xml-parser');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
    });
    try {
        const data = typeof responseData === 'string'
            ? responseData
            : responseData.data ||
                JSON.stringify(responseData);
        const result = parser.parse(data);
        // Check for properties element
        const properties = result['chkl:messages']?.['chkl:properties'];
        const activated = properties?.['@_activationExecuted'] === 'true' ||
            properties?.['@_activationExecuted'] === true;
        const checked = properties?.['@_checkExecuted'] === 'true' ||
            properties?.['@_checkExecuted'] === true;
        const generated = properties?.['@_generationExecuted'] === 'true' ||
            properties?.['@_generationExecuted'] === true;
        // Parse messages (warnings/errors)
        const messages = [];
        const msgData = result['chkl:messages']?.msg;
        if (msgData) {
            const msgArray = Array.isArray(msgData) ? msgData : [msgData];
            msgArray.forEach((msg) => {
                const st = msg.shortText;
                messages.push({
                    type: String(msg['@_type'] || 'info'),
                    text: String((typeof st === 'object' && st ? st.txt : st) || 'Unknown message'),
                    line: msg['@_line'],
                    column: msg['@_column'],
                });
            });
        }
        return {
            activated,
            checked,
            generated,
            messages,
        };
    }
    catch (_error) {
        return {
            activated: false,
            checked: false,
            generated: false,
            messages: [
                { type: 'error', text: 'Failed to parse activation response' },
            ],
        };
    }
}
/**
 * Check ABAP object syntax
 * Uses shared checkRun utility for all object types
 */
async function checkObject(connection, name, type, version) {
    const { runCheckRun } = await Promise.resolve().then(() => __importStar(require('../utils/checkRun')));
    return runCheckRun(connection, type, name, version || 'active', 'abapCheckRun');
}
