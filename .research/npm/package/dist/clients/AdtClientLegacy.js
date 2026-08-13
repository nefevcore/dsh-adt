"use strict";
/**
 * AdtClientLegacy - ADT Client for older SAP systems (BASIS < 7.50)
 *
 * Extends AdtClient and overrides methods that differ on legacy systems:
 * - Unsupported object types throw clear errors
 * - Supported types use legacy-compatible deletion (direct DELETE vs /deletion/delete)
 * - Content-Type defaults to v1 (AdtContentTypesBase)
 * - Transport requests use /sap/bc/cts/ instead of /sap/bc/adt/cts/
 *
 * Use createAdtClient() factory to auto-detect and instantiate.
 *
 * Unsupported types are determined by /sap/bc/adt/discovery catalog —
 * endpoints not present in legacy system discovery are blocked here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtClientLegacy = void 0;
const AdtClassLegacy_1 = require("../core/class/AdtClassLegacy");
const AdtDdlLegacy_1 = require("../core/ddl/AdtDdlLegacy");
const AdtFunctionGroupLegacy_1 = require("../core/functionGroup/AdtFunctionGroupLegacy");
const AdtFunctionModuleLegacy_1 = require("../core/functionModule/AdtFunctionModuleLegacy");
const AdtInterfaceLegacy_1 = require("../core/interface/AdtInterfaceLegacy");
const AdtPackageLegacy_1 = require("../core/package/AdtPackageLegacy");
const AdtProgramLegacy_1 = require("../core/program/AdtProgramLegacy");
const AdtUtilsLegacy_1 = require("../core/shared/AdtUtilsLegacy");
const contentTypes_1 = require("../core/shared/contentTypes");
const AdtRequestLegacy_1 = require("../core/transport/AdtRequestLegacy");
const AdtUnitTestLegacy_1 = require("../core/unitTest/AdtUnitTestLegacy");
const AdtClient_1 = require("./AdtClient");
/**
 * Error message for unsupported object types on legacy systems.
 * The endpoint is not present in the /sap/bc/adt/discovery catalog.
 */
function unsupportedError(objectType, endpoint) {
    return (`${objectType} is not supported on this SAP system. ` +
        `The required endpoint ${endpoint} was not found in the system's ` +
        `ADT discovery catalog (/sap/bc/adt/discovery). ` +
        `This typically means the system's BASIS version is too old.`);
}
class AdtClientLegacy extends AdtClient_1.AdtClient {
    constructor(connection, logger, options) {
        super(connection, logger, {
            ...options,
            contentTypes: options?.contentTypes ?? new contentTypes_1.AdtContentTypesBase(options?.unicode),
        });
    }
    // --- Supported types with legacy overrides ---
    getProgram() {
        return new AdtProgramLegacy_1.AdtProgramLegacy(this.connection, this.logger, this.systemContext, this.contentTypes);
    }
    getClass() {
        return new AdtClassLegacy_1.AdtClassLegacy(this.connection, this.logger, this.systemContext, this.contentTypes);
    }
    getInterface() {
        return new AdtInterfaceLegacy_1.AdtInterfaceLegacy(this.connection, this.logger, this.systemContext, this.contentTypes);
    }
    getFunctionGroup() {
        return new AdtFunctionGroupLegacy_1.AdtFunctionGroupLegacy(this.connection, this.logger, this.systemContext, this.contentTypes);
    }
    getFunctionModule() {
        return new AdtFunctionModuleLegacy_1.AdtFunctionModuleLegacy(this.connection, this.logger, this.systemContext, this.contentTypes);
    }
    getPackage() {
        return new AdtPackageLegacy_1.AdtPackageLegacy(this.connection, this.logger, this.systemContext);
    }
    getDdl() {
        return new AdtDdlLegacy_1.AdtDdlLegacy(this.connection, this.logger, this.systemContext);
    }
    // --- Unit tests with legacy endpoints ---
    getUnitTest() {
        return new AdtUnitTestLegacy_1.AdtUnitTestLegacy(this.connection, this.logger);
    }
    // --- Transport with legacy URL prefix ---
    getRequest() {
        return new AdtRequestLegacy_1.AdtRequestLegacy(this.connection, this.logger, this.systemContext);
    }
    // --- Utilities with legacy restrictions ---
    getUtils() {
        return new AdtUtilsLegacy_1.AdtUtilsLegacy(this.connection, this.logger);
    }
    // --- CDS Unit Test: requires modern CDS endpoints ---
    getCdsUnitTest() {
        throw new Error(unsupportedError('CDS Unit Test', '/sap/bc/adt/ddic/ddl/sources (CDS framework)'));
    }
    // --- Unsupported types: endpoints absent from legacy /sap/bc/adt/discovery ---
    getDomain() {
        throw new Error(unsupportedError('Domain', '/sap/bc/adt/ddic/domains'));
    }
    getDataElement() {
        throw new Error(unsupportedError('DataElement', '/sap/bc/adt/ddic/dataelements'));
    }
    getStructure() {
        throw new Error(unsupportedError('Structure', '/sap/bc/adt/ddic/structures'));
    }
    getTable() {
        throw new Error(unsupportedError('Table', '/sap/bc/adt/ddic/tables'));
    }
    getTableType() {
        throw new Error(unsupportedError('TableType', '/sap/bc/adt/ddic/tabletypes'));
    }
    getAccessControl() {
        throw new Error(unsupportedError('AccessControl', '/sap/bc/adt/acm/dcl/sources'));
    }
    getServiceDefinition() {
        throw new Error(unsupportedError('ServiceDefinition', '/sap/bc/adt/ddic/srvd/sources'));
    }
    getServiceBinding() {
        throw new Error(unsupportedError('ServiceBinding', '/sap/bc/adt/businessservices/bindings'));
    }
    getService() {
        throw new Error(unsupportedError('ServiceBinding', '/sap/bc/adt/businessservices/bindings'));
    }
    getBehaviorDefinition() {
        throw new Error(unsupportedError('BehaviorDefinition', '/sap/bc/adt/bo/behaviordefinitions'));
    }
    getBehaviorImplementation() {
        throw new Error(unsupportedError('BehaviorImplementation', '/sap/bc/adt/bo/behaviordefinitions'));
    }
    getMetadataExtension() {
        throw new Error(unsupportedError('MetadataExtension', '/sap/bc/adt/ddic/ddlx/sources'));
    }
    getEnhancement() {
        throw new Error(unsupportedError('Enhancement', '/sap/bc/adt/enhancements'));
    }
}
exports.AdtClientLegacy = AdtClientLegacy;
