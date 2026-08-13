"use strict";
/**
 * DataElement update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
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
exports.getDomainInfo = getDomainInfo;
exports.updateDataElement = updateDataElement;
exports.updateDataElementInternal = updateDataElementInternal;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlPatch_1 = require("../../utils/xmlPatch");
const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
/**
 * Get domain info to extract dataType, length, decimals
 */
async function getDomainInfo(connection, domainName) {
    const { XMLParser } = await Promise.resolve().then(() => __importStar(require('fast-xml-parser')));
    const domainNameEncoded = (0, internalUtils_1.encodeSapObjectName)(domainName.toLowerCase());
    const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_DOMAIN,
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const domainXml = result['doma:domain'];
    return {
        dataType: domainXml['doma:content']?.['doma:typeInformation']?.['doma:datatype'] ||
            'CHAR',
        length: domainXml['doma:content']?.['doma:typeInformation']?.['doma:length'] ||
            100,
        decimals: domainXml['doma:content']?.['doma:typeInformation']?.['doma:decimals'] ||
            0,
    };
}
/**
 * Patch current data element XML with updated values.
 * Only modifies fields that are explicitly provided in args.
 */
function patchDataElementXml(currentXml, args) {
    let xml = currentXml;
    // Description
    if (args.description) {
        const description = (0, internalUtils_1.limitDescription)(args.description);
        xml = (0, xmlPatch_1.patchXmlAttribute)(xml, 'adtcore:description', description);
    }
    // Type information
    xml = (0, xmlPatch_1.patchIf)(xml, args.type_kind, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'dtel:typeKind', val));
    // typeName — handle domain type: use type_name or data_type as domain name
    if (args.type_kind || args.type_name || args.data_type) {
        let typeName = '';
        if (args.type_kind === 'domain') {
            typeName = (args.type_name || args.data_type || '').toUpperCase();
        }
        else if (args.type_name) {
            typeName = args.type_name.toUpperCase();
        }
        if (typeName) {
            xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:typeName', typeName);
        }
    }
    xml = (0, xmlPatch_1.patchIf)(xml, args.data_type, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'dtel:dataType', val));
    xml = (0, xmlPatch_1.patchIf)(xml, args.length, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'dtel:dataTypeLength', String(val).padStart(6, '0')));
    xml = (0, xmlPatch_1.patchIf)(xml, args.decimals, (x, val) => (0, xmlPatch_1.patchXmlElement)(x, 'dtel:dataTypeDecimals', String(val).padStart(6, '0')));
    // Labels
    if (args.short_label !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:shortFieldLabel', args.short_label);
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:shortFieldLength', String(args.short_label.length || 10));
    }
    if (args.medium_label !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:mediumFieldLabel', args.medium_label);
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:mediumFieldLength', String(args.medium_label.length || 20));
    }
    if (args.long_label !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:longFieldLabel', args.long_label);
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:longFieldLength', String(args.long_label.length || 40));
    }
    if (args.heading_label !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:headingFieldLabel', args.heading_label);
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:headingFieldLength', String(args.heading_label.length || 55));
    }
    // Optional fields
    if (args.search_help !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:searchHelp', args.search_help);
    }
    if (args.search_help_parameter !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:searchHelpParameter', args.search_help_parameter);
    }
    if (args.set_get_parameter !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:setGetParameter', args.set_get_parameter);
    }
    if (args.default_component_name !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:defaultComponentName', args.default_component_name);
    }
    if (args.deactivate_input_history !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:deactivateInputHistory', String(args.deactivate_input_history));
    }
    if (args.change_document !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:changeDocument', String(args.change_document));
    }
    if (args.left_to_right_direction !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:leftToRightDirection', String(args.left_to_right_direction));
    }
    if (args.deactivate_bidi_filtering !== undefined) {
        xml = (0, xmlPatch_1.patchXmlElement)(xml, 'dtel:deactivateBIDIFiltering', String(args.deactivate_bidi_filtering));
    }
    return xml;
}
/**
 * Update data element - atomic PUT operation (read-modify-write pattern)
 * NOTE: Requires object to be locked first via lockDataElement()
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */
async function updateDataElement(connection, params, lockHandle, logger) {
    if (!params.data_element_name) {
        throw new Error('Data element name is required');
    }
    if (!params.package_name) {
        throw new Error('Package name is required');
    }
    const dataElementNameEncoded = (0, internalUtils_1.encodeSapObjectName)(params.data_element_name.toLowerCase());
    // 1. GET current XML
    const currentResponse = await connection.makeAdtRequest({
        url: `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_DATA_ELEMENT },
    });
    const currentXml = (0, xmlPatch_1.extractXmlString)(currentResponse.data, `data element ${params.data_element_name}`);
    // 2. Patch only changed fields
    const updatedXml = patchDataElementXml(currentXml, params);
    // Debug: log XML when DEBUG_ADT_LIBS is enabled
    if (debugEnabled) {
        logger?.debug?.('[UPDATE XML]');
        try {
            const { XMLParser, XMLBuilder } = await Promise.resolve().then(() => __importStar(require('fast-xml-parser')));
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '',
            });
            const builder = new XMLBuilder({
                ignoreAttributes: false,
                attributeNamePrefix: '',
                format: true,
                indentBy: '  ',
            });
            const parsed = parser.parse(updatedXml);
            const formatted = builder.build(parsed);
            logger?.debug?.(formatted);
        }
        catch {
            logger?.debug?.(updatedXml);
        }
    }
    // 3. PUT
    const corrNrParam = params.transport_request
        ? `&corrNr=${params.transport_request}`
        : '';
    const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_DATA_ELEMENT,
        'Content-Type': 'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8',
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: updatedXml,
        headers,
    });
}
/**
 * @deprecated Use updateDataElement directly. Kept for backward compatibility.
 */
async function updateDataElementInternal(connection, args, lockHandle, _username, _domainInfo, logger) {
    return updateDataElement(connection, args, lockHandle, logger);
}
