"use strict";
/**
 * Transport create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransport = createTransport;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create transport request XML payload
 */
function buildCreateTransportXml(args, username) {
    const transportType = args.transport_type === 'customizing' ? 'T' : 'K';
    const description = args.description || 'Transport request created via MCP';
    const owner = args.owner || username;
    const target = args.target_system?.trim()
        ? `/${args.target_system}/`
        : 'LOCAL';
    return `<?xml version="1.0" encoding="ASCII"?>
<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:useraction="newrequest">
  <tm:request tm:desc="${description}" tm:type="${transportType}" tm:target="${target}" tm:cts_project="">
    <tm:task tm:owner="${owner}"/>
  </tm:request>
</tm:root>`;
}
/**
 * Parse transport creation response
 */
function parseTransportResponse(xmlData) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
    });
    const result = parser.parse(xmlData);
    const root = result['tm:root'] || result.root;
    if (!root) {
        throw new Error('Invalid transport response XML structure - no tm:root found');
    }
    const request = root['tm:request'] || {};
    const task = request['tm:task'] || {};
    return {
        transport_number: request['tm:number'],
        description: request['tm:desc'] || request['tm:description'],
        type: request['tm:type'],
        target_system: request['tm:target'],
        target_desc: request['tm:target_desc'],
        cts_project: request['tm:cts_project'],
        cts_project_desc: request['tm:cts_project_desc'],
        uri: request['tm:uri'],
        parent: request['tm:parent'],
        owner: task['tm:owner'] || request['tm:owner'],
    };
}
/**
 * Create ABAP transport request
 */
async function createTransport(connection, params) {
    if (!params.description) {
        throw new Error('Transport description is required');
    }
    const username = params.owner;
    if (!username) {
        throw new Error('Cannot create transport request: owner is required. Please provide owner in params.');
    }
    const url = `/sap/bc/adt/cts/transportrequests`;
    const xmlBody = buildCreateTransportXml(params, username);
    const headers = {
        Accept: contentTypes_1.ACCEPT_TRANSPORT,
        'Content-Type': 'text/plain',
    };
    try {
        const response = await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: xmlBody,
            headers,
        });
        const transportInfo = parseTransportResponse(response.data);
        const requestOwner = params.owner || username;
        return {
            data: {
                success: true,
                transport_request: transportInfo.transport_number,
                description: transportInfo.description,
                type: transportInfo.type,
                target_system: transportInfo.target_system,
                target_desc: transportInfo.target_desc,
                cts_project: transportInfo.cts_project,
                owner: requestOwner,
                uri: transportInfo.uri,
                message: `Transport request ${transportInfo.transport_number} created successfully`,
            },
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        };
    }
    catch (error) {
        const e = error;
        const errorMessage = e.response?.data
            ? typeof e.response.data === 'string'
                ? e.response.data
                : (0, internalUtils_1.safeStringify)(e.response.data)
            : e.message;
        throw new Error(`Failed to create transport request: ${errorMessage}`);
    }
}
