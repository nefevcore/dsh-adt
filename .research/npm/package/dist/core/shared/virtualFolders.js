"use strict";
/**
 * Virtual folders operations for ABAP objects
 *
 * Retrieves hierarchical virtual folder contents from ADT information system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVirtualFoldersContents = getVirtualFoldersContents;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const VIRTUAL_FOLDERS_NAMESPACE = 'http://www.sap.com/adt/ris/virtualFolders';
const escapeXml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const buildPreselectionXml = (preselection) => {
    if (!preselection || preselection.length === 0) {
        return '';
    }
    return preselection
        .map((entry) => {
        const valuesXml = entry.values
            .map((value) => `<vfs:value>${escapeXml(value)}</vfs:value>`)
            .join('');
        return `<vfs:preselection facet="${escapeXml(entry.facet)}">${valuesXml}</vfs:preselection>`;
    })
        .join('');
};
const buildFacetOrderXml = (facetOrder) => {
    if (facetOrder.length === 0) {
        return '';
    }
    const facetsXml = facetOrder
        .map((facet) => `<vfs:facet>${escapeXml(facet)}</vfs:facet>`)
        .join('');
    return `<vfs:facetorder>${facetsXml}</vfs:facetorder>`;
};
const buildVirtualFoldersRequestXml = (params) => {
    const objectSearchPattern = escapeXml(params.objectSearchPattern ?? '*');
    const preselectionXml = buildPreselectionXml(params.preselection);
    const facetOrder = params.facetOrder ?? ['package', 'group', 'type'];
    const facetOrderXml = buildFacetOrderXml(facetOrder);
    return `<?xml version="1.0" encoding="UTF-8"?><vfs:virtualFoldersRequest xmlns:vfs="${VIRTUAL_FOLDERS_NAMESPACE}" objectSearchPattern="${objectSearchPattern}">${preselectionXml}${facetOrderXml}</vfs:virtualFoldersRequest>`;
};
/**
 * Fetch virtual folder contents for hierarchical browsing.
 *
 * Endpoint: POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents
 */
async function getVirtualFoldersContents(connection, params) {
    const url = `/sap/bc/adt/repository/informationsystem/virtualfolders/contents`;
    const queryParams = {};
    if (params.withVersions !== undefined) {
        queryParams.withVersions = String(params.withVersions);
    }
    if (params.ignoreShortDescriptions !== undefined) {
        queryParams.ignoreShortDescriptions = String(params.ignoreShortDescriptions);
    }
    const xmlBody = buildVirtualFoldersRequestXml(params);
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_VIRTUAL_FOLDERS,
            'Content-Type': contentTypes_1.CT_VIRTUAL_FOLDERS,
        },
    });
}
