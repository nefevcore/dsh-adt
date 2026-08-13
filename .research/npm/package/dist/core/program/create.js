"use strict";
/**
 * Program create operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Convert readable program type to SAP internal code
 */
function convertProgramType(programType) {
    const typeMap = {
        executable: '1',
        include: 'I',
        module_pool: 'M',
        function_group: 'F',
        class_pool: 'K',
        interface_pool: 'J',
    };
    return typeMap[programType || 'executable'] || '1';
}
/**
 * Generate minimal program source code if not provided
 */
function _generateProgramTemplate(programName, programType, description) {
    const upperName = programName.toUpperCase();
    switch (programType) {
        case 'I': // Include
            return `*&---------------------------------------------------------------------*
*& Include ${upperName}
*& ${description}
*&---------------------------------------------------------------------*

" Include program logic here
`;
        case 'M': // Module Pool
            return `*&---------------------------------------------------------------------*
*& Module Pool ${upperName}
*& ${description}
*&---------------------------------------------------------------------*

PROGRAM ${upperName}.
`;
        default:
            return `*&---------------------------------------------------------------------*
*& Report ${upperName}
*& ${description}
*&---------------------------------------------------------------------*
REPORT ${upperName}.

START-OF-SELECTION.
  WRITE: / 'Program ${upperName} executed successfully.'.
`;
    }
}
/**
 * Low-level: Create program object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 */
async function create(connection, args, contentTypes) {
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(args.description || args.programName);
    const programType = convertProgramType(args.programType);
    const application = args.application || '*';
    const url = `/sap/bc/adt/programs/programs${args.transportRequest ? `?corrNr=${args.transportRequest}` : ''}`;
    const masterSystem = args.masterSystem || '';
    const username = args.responsible || '';
    const lang = args.masterLanguage || 'EN';
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
    const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${args.programName}" adtcore:type="PROG/P" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr} program:programType="${programType}" program:application="${application}">
  <adtcore:packageRef adtcore:name="${args.packageName}"/>
</program:abapProgram>`;
    const ct = contentTypes?.programCreate();
    const headers = {
        Accept: ct?.accept || contentTypes_1.CT_PROGRAM,
        'Content-Type': ct?.contentType || contentTypes_1.CT_PROGRAM,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: metadataXml,
        headers,
    });
}
/**
 * Upload program source code
 */
async function _uploadProgramSource(connection, programName, sourceCode, lockHandle, _sessionId, transportRequest) {
    const queryParams = `lockHandle=${encodeURIComponent(lockHandle)}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
    const url = `/sap/bc/adt/programs/programs/${(0, internalUtils_1.encodeSapObjectName)(programName).toLowerCase()}/source/main?${queryParams}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_SOURCE,
        'Content-Type': contentTypes_1.CT_SOURCE,
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: sourceCode,
        headers,
    });
}
