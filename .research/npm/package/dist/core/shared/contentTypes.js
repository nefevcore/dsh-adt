"use strict";
/**
 * ADT Content-Type / Accept header provider
 *
 * Base class provides v1 headers (universal, works on all systems).
 * Modern subclass overrides with v2+ for newer systems (S/4 HANA, BTP).
 *
 * Each method returns { accept, contentType } for a specific operation.
 * Accept can contain multiple values (comma-separated), Content-Type is always single.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtContentTypesModern = exports.AdtContentTypesBase = void 0;
/**
 * Base content types — v1 headers, works on all SAP systems including older BASIS
 */
class AdtContentTypesBase {
    unicode;
    constructor(unicode = false) {
        this.unicode = unicode;
    }
    programCreate() {
        return {
            accept: 'application/vnd.sap.adt.programs.programs+xml',
            contentType: 'application/vnd.sap.adt.programs.programs+xml',
        };
    }
    programRead() {
        return {
            accept: 'application/vnd.sap.adt.programs.programs.v3+xml, application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs+xml',
            contentType: 'application/vnd.sap.adt.programs.programs+xml',
        };
    }
    classCreate() {
        return {
            accept: 'application/vnd.sap.adt.oo.classes+xml',
            contentType: 'application/vnd.sap.adt.oo.classes+xml',
        };
    }
    classRead() {
        return {
            accept: 'application/vnd.sap.adt.oo.classes+xml',
            contentType: 'application/vnd.sap.adt.oo.classes+xml',
        };
    }
    interfaceCreate() {
        return {
            accept: 'application/vnd.sap.adt.oo.interfaces+xml',
            contentType: 'application/vnd.sap.adt.oo.interfaces+xml',
        };
    }
    domainCreate() {
        return {
            accept: 'application/vnd.sap.adt.domains.v1+xml',
            contentType: 'application/vnd.sap.adt.domains.v1+xml',
        };
    }
    domainRead() {
        return {
            accept: 'application/vnd.sap.adt.domains.v1+xml',
            contentType: 'application/vnd.sap.adt.domains.v1+xml',
        };
    }
    domainUpdate() {
        return {
            accept: 'application/vnd.sap.adt.domains.v1+xml',
            contentType: 'application/vnd.sap.adt.domains.v1+xml; charset=utf-8',
        };
    }
    dataElementCreate() {
        return {
            accept: 'application/vnd.sap.adt.dataelements.v1+xml',
            contentType: 'application/vnd.sap.adt.dataelements.v1+xml',
        };
    }
    dataElementRead() {
        return {
            accept: 'application/vnd.sap.adt.dataelements.v1+xml',
            contentType: 'application/vnd.sap.adt.dataelements.v1+xml',
        };
    }
    dataElementUpdate() {
        return {
            accept: 'application/vnd.sap.adt.dataelements.v1+xml',
            contentType: 'application/vnd.sap.adt.dataelements.v1+xml; charset=utf-8',
        };
    }
    structureCreate() {
        return {
            accept: 'application/vnd.sap.adt.structures.v1+xml',
            contentType: 'application/vnd.sap.adt.structures.v1+xml',
        };
    }
    tableCreate() {
        return {
            accept: 'application/vnd.sap.adt.tables.v1+xml',
            contentType: 'application/vnd.sap.adt.tables.v1+xml',
        };
    }
    packageCreate() {
        return {
            accept: 'application/vnd.sap.adt.packages.v1+xml',
            contentType: 'application/vnd.sap.adt.packages.v1+xml',
        };
    }
    packageRead() {
        return {
            accept: 'application/vnd.sap.adt.packages.v1+xml',
            contentType: 'application/vnd.sap.adt.packages.v1+xml',
        };
    }
    packageUpdate() {
        return {
            accept: 'application/vnd.sap.adt.packages.v1+xml',
            contentType: 'application/vnd.sap.adt.packages.v1+xml',
        };
    }
    functionGroupCreate() {
        return {
            accept: 'application/vnd.sap.adt.functions.groups+xml',
            contentType: 'application/vnd.sap.adt.functions.groups+xml',
        };
    }
    functionGroupUpdate() {
        return {
            accept: 'application/vnd.sap.adt.functions.groups+xml',
            contentType: 'application/vnd.sap.adt.functions.groups+xml; charset=utf-8',
        };
    }
    sourceArtifactContentType() {
        return this.unicode ? 'text/plain; charset=utf-8' : 'text/plain';
    }
}
exports.AdtContentTypesBase = AdtContentTypesBase;
/**
 * Modern content types — v2+ headers for S/4 HANA, BTP, and newer BASIS systems.
 * Accept includes both new and old versions for compatibility.
 * Content-Type uses the newest version.
 */
class AdtContentTypesModern extends AdtContentTypesBase {
    constructor() {
        super(true);
    }
    classCreate() {
        return {
            accept: 'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes+xml',
            contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
        };
    }
    classRead() {
        return {
            accept: 'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes.v3+xml, application/vnd.sap.adt.oo.classes.v2+xml, application/vnd.sap.adt.oo.classes+xml',
            contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
        };
    }
    interfaceCreate() {
        return {
            accept: 'application/vnd.sap.adt.oo.interfaces.v5+xml, application/vnd.sap.adt.oo.interfaces+xml',
            contentType: 'application/vnd.sap.adt.oo.interfaces.v5+xml',
        };
    }
    programCreate() {
        return {
            accept: 'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs+xml',
            contentType: 'application/vnd.sap.adt.programs.programs.v2+xml',
        };
    }
    programRead() {
        return {
            accept: 'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs+xml',
            contentType: 'application/vnd.sap.adt.programs.programs.v2+xml',
        };
    }
    domainCreate() {
        return {
            accept: 'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml',
            contentType: 'application/vnd.sap.adt.domains.v2+xml',
        };
    }
    domainRead() {
        return {
            accept: 'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml',
            contentType: 'application/vnd.sap.adt.domains.v2+xml',
        };
    }
    domainUpdate() {
        return {
            accept: 'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml',
            contentType: 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
        };
    }
    dataElementCreate() {
        return {
            accept: 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
            contentType: 'application/vnd.sap.adt.dataelements.v2+xml',
        };
    }
    dataElementRead() {
        return {
            accept: 'application/vnd.sap.adt.dataelements.v2+xml, application/vnd.sap.adt.dataelements.v1+xml',
            contentType: 'application/vnd.sap.adt.dataelements.v2+xml',
        };
    }
    dataElementUpdate() {
        return {
            accept: 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
            contentType: 'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8',
        };
    }
    structureCreate() {
        return {
            accept: 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
            contentType: 'application/vnd.sap.adt.structures.v2+xml',
        };
    }
    tableCreate() {
        return {
            accept: 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml',
            contentType: 'application/vnd.sap.adt.tables.v2+xml',
        };
    }
    packageCreate() {
        return {
            accept: 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
            contentType: 'application/vnd.sap.adt.packages.v2+xml',
        };
    }
    packageRead() {
        return {
            accept: 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
            contentType: 'application/vnd.sap.adt.packages.v2+xml',
        };
    }
    packageUpdate() {
        return {
            accept: 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
            contentType: 'application/vnd.sap.adt.packages.v2+xml',
        };
    }
    functionGroupCreate() {
        return {
            accept: 'application/vnd.sap.adt.functions.groups.v3+xml',
            contentType: 'application/vnd.sap.adt.functions.groups.v3+xml',
        };
    }
    functionGroupUpdate() {
        return {
            accept: 'application/vnd.sap.adt.functions.groups.v3+xml',
            contentType: 'application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8',
        };
    }
}
exports.AdtContentTypesModern = AdtContentTypesModern;
