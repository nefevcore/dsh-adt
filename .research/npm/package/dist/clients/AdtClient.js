"use strict";
/**
 * AdtClient - High-level ADT Object Operations Client
 *
 * Provides simplified CRUD operations with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * AdtClient provides high-level methods that encapsulate complex operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 *
 * Each factory method returns an IAdtObject instance that can be used
 * to perform operations on a specific object type.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtClient = void 0;
const interfaces_1 = require("@mcp-abap-adt/interfaces");
const accessControl_1 = require("../core/accessControl");
const appendStructure_1 = require("../core/appendStructure");
const authorizationField_1 = require("../core/authorizationField");
const behaviorDefinition_1 = require("../core/behaviorDefinition");
const behaviorImplementation_1 = require("../core/behaviorImplementation");
const class_1 = require("../core/class");
const dataElement_1 = require("../core/dataElement");
const ddl_1 = require("../core/ddl");
const domain_1 = require("../core/domain");
const enhancement_1 = require("../core/enhancement");
const featureToggle_1 = require("../core/featureToggle");
const functionGroup_1 = require("../core/functionGroup");
const functionInclude_1 = require("../core/functionInclude");
const functionModule_1 = require("../core/functionModule");
const interface_1 = require("../core/interface");
const messageClass_1 = require("../core/messageClass");
const metadataExtension_1 = require("../core/metadataExtension");
const package_1 = require("../core/package");
const program_1 = require("../core/program");
const scalarFunction_1 = require("../core/scalarFunction");
const scalarFunctionImplementation_1 = require("../core/scalarFunctionImplementation");
const service_1 = require("../core/service");
const serviceDefinition_1 = require("../core/serviceDefinition");
const AdtUtils_1 = require("../core/shared/AdtUtils");
const LockRegistry_1 = require("../core/shared/LockRegistry");
const structure_1 = require("../core/structure");
const table_1 = require("../core/table");
const tabletype_1 = require("../core/tabletype");
const transformation_1 = require("../core/transformation");
const transport_1 = require("../core/transport");
const unitTest_1 = require("../core/unitTest");
class AdtClient {
    connection;
    logger;
    systemContext;
    contentTypes;
    /**
     * Session-scoped registry of locks held by handlers created from this client.
     * All handlers share one stateful session, so all their locks belong here.
     */
    lockRegistry;
    constructor(connection, logger, options) {
        this.connection = connection;
        // Pass the connection so unlockAll() can keep the whole batch stateful.
        this.lockRegistry = new LockRegistry_1.LockRegistry(connection);
        this.logger = logger ?? {
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
        };
        this.systemContext = {
            masterSystem: options?.masterSystem,
            responsible: options?.responsible,
            masterLanguage: options?.masterLanguage,
        };
        this.contentTypes = options?.contentTypes;
        if (options?.enableAcceptCorrection !== undefined) {
            const { setAcceptCorrectionEnabled, wrapConnectionAcceptNegotiation, getAcceptCorrectionEnabled, } = require('../utils/acceptNegotiation');
            setAcceptCorrectionEnabled(options.enableAcceptCorrection);
            const shouldWrap = options.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
            if (shouldWrap) {
                wrapConnectionAcceptNegotiation(this.connection, this.logger);
            }
        }
        else {
            const { getAcceptCorrectionEnabled, wrapConnectionAcceptNegotiation, } = require('../utils/acceptNegotiation');
            if (getAcceptCorrectionEnabled()) {
                wrapConnectionAcceptNegotiation(this.connection, this.logger);
            }
        }
    }
    /**
     * Refuses to hand out a handler over a connection nobody connected.
     *
     * Connecting is the CONSUMER's job and stays that way — this library does not
     * own the connection and must not connect on anyone's behalf. What it can do
     * is catch the case where a connector was injected and `connect()` was never
     * called, which otherwise surfaces deep in an operation chain: the handlers
     * collect failures into `state.errors` rather than stopping, so a missing
     * connection arrives as a state object full of `ADT_NOT_CONNECTED` after the
     * chain has walked its whole length. Failing here turns that into nothing
     * having happened at all.
     *
     * Only asked of a connection that ANSWERS the question. `isConnected()` lives
     * on `ISessionLifecycleAware`, not on `IAbapConnection`: an RFC connection has
     * no HTTP session and no such method, and a transport that cannot answer must
     * not be blocked on its silence. This is a real limit, not an oversight — a
     * transport with no session has no "not connected" state to catch, so the
     * promise this guard makes is necessarily narrower than "every
     * `IAbapConnection`".
     *
     * It checks ONLY `isConnected`, which is the only method it calls. That is a
     * different rule from the one for a type predicate, and the difference is
     * worth stating because the two look alike: a predicate narrows to the WHOLE
     * interface, so it must verify the whole interface or its caller will invoke a
     * method that is not there. This asks one question and calls one method, so
     * demanding the other two would only make it step aside for a connection that
     * could have answered — refusing evidence it was offered.
     */
    assertConnected() {
        const candidate = this.connection;
        if (typeof candidate.isConnected !== 'function')
            return;
        if (!candidate.isConnected()) {
            const error = new Error('AdtClient: the connection is not connected. Call connect() on it before ' +
                'requesting a handler — this library does not connect on your behalf.');
            error.code = interfaces_1.ADT_SESSION_ERROR.NOT_CONNECTED;
            throw error;
        }
    }
    /**
     * Get high-level operations for Class objects
     * @returns IAdtObject instance for Class operations
     */
    getClass() {
        this.assertConnected();
        return new class_1.AdtClass(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for Program objects
     * @returns IAdtObject instance for Program operations
     */
    getProgram() {
        this.assertConnected();
        return new program_1.AdtProgram(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for Interface objects
     * @returns IAdtObject instance for Interface operations
     */
    getInterface() {
        this.assertConnected();
        return new interface_1.AdtInterface(this.connection, this.logger, this.systemContext, undefined, this.lockRegistry);
    }
    /**
     * Get high-level operations for Domain objects
     * @returns IAdtObject instance for Domain operations
     */
    getDomain() {
        this.assertConnected();
        return new domain_1.AdtDomain(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Last-resort cleanup: release every lock still held by handlers created from
     * this client. Returns the locks that could not be released.
     *
     * This is a safety net for abandoned locks (a forgot-to-unlock, or a managed
     * flow that threw before its unlock). Preventing a timeout from interrupting a
     * lock→unlock critical section remains the caller's responsibility.
     */
    async unlockAll() {
        return this.lockRegistry.unlockAll();
    }
    /**
     * Keys of locks currently held by handlers created from this client
     * (e.g. `Domain/ZFOO`, `DataElement/ZBAR`). Lets a consumer inspect whether a
     * session was left with dangling locks before deciding to `unlockAll()`.
     */
    get pendingLocks() {
        return this.lockRegistry.pending;
    }
    /**
     * Release all held locks when used with `await using`.
     *
     * Best-effort: like {@link unlockAll}, this never throws — a lock whose unlock
     * fails is retained rather than surfaced as an error, so a disposer failure
     * cannot mask the error that ended the `using` scope. Any residual failures
     * are logged as a warning and remain observable via {@link pendingLocks}.
     * Callers that must react to unlock failures should call `unlockAll()`
     * explicitly and inspect the returned `LockFailure[]`.
     */
    async [Symbol.asyncDispose]() {
        const failures = await this.unlockAll();
        if (failures.length > 0) {
            this.logger.warn(`[AdtClient] dispose left ${failures.length} lock(s) unreleased: ${failures
                .map((f) => f.key)
                .join(', ')}. They remain in pendingLocks; retry unlockAll() or rely on session-drop.`);
        }
    }
    /**
     * Get high-level operations for DataElement objects
     * @returns IAdtObject instance for DataElement operations
     */
    getDataElement() {
        this.assertConnected();
        return new dataElement_1.AdtDataElement(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for AuthorizationField objects
     * @returns IAdtObject instance for AuthorizationField operations
     */
    getAuthorizationField() {
        this.assertConnected();
        return new authorizationField_1.AdtAuthorizationField(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for Structure objects
     * @returns IAdtObject instance for Structure operations
     */
    getStructure() {
        this.assertConnected();
        return new structure_1.AdtStructure(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for Table objects
     * @returns IAdtObject instance for Table operations
     */
    getTable() {
        this.assertConnected();
        return new table_1.AdtTable(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for TableType (DDIC Table Type) objects
     * @returns IAdtObject instance for TableType operations
     */
    getTableType() {
        this.assertConnected();
        return new tabletype_1.AdtDdicTableType(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Generic client for ABAP DDL source objects (`/sap/bc/adt/ddic/ddl/sources/`):
     * CDS views, AMDP table functions, and other DDL sources. Classic DDIC structures
     * (`/ddic/structures/`), tables (`/ddic/tables/`), and scalar functions
     * (`/ddic/dsfd/sources/`) have their own clients.
     * @returns IAdtObject instance for DDL source operations
     */
    getDdl() {
        this.assertConnected();
        return new ddl_1.AdtDdl(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for FunctionGroup objects
     * @returns IAdtObject instance for FunctionGroup operations
     */
    getFunctionGroup() {
        this.assertConnected();
        return new functionGroup_1.AdtFunctionGroup(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for FunctionModule objects
     * @returns IAdtObject instance for FunctionModule operations
     */
    getFunctionModule() {
        this.assertConnected();
        return new functionModule_1.AdtFunctionModule(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for FunctionInclude objects
     * @returns IAdtObject instance for FunctionInclude operations
     */
    getFunctionInclude() {
        this.assertConnected();
        return new functionInclude_1.AdtFunctionInclude(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for Package objects
     * @returns IAdtObject instance for Package operations
     */
    getPackage() {
        this.assertConnected();
        return new package_1.AdtPackage(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for MessageClass (MSAG/N) objects
     * @returns IAdtObject instance for MessageClass operations
     */
    getMessageClass() {
        this.assertConnected();
        return new messageClass_1.AdtMessageClass(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for a single message within a MessageClass.
     * Supports read, create/update (upsert), and delete of individual messages.
     * @returns IAdtObject instance for MessageClassMessage operations
     */
    getMessageClassMessage() {
        this.assertConnected();
        return new messageClass_1.AdtMessageClassMessage(this.connection, this.logger);
    }
    /**
     * Get high-level operations for AccessControl objects
     * @returns IAdtObject instance for AccessControl operations
     */
    getAccessControl() {
        this.assertConnected();
        return new accessControl_1.AdtAccessControl(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for Transformation objects (XSLT)
     * Supports both SimpleTransformation and XSLTProgram types
     * @returns IAdtObject instance for Transformation operations
     */
    getTransformation() {
        this.assertConnected();
        return new transformation_1.AdtTransformation(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for ServiceDefinition objects
     * @returns IAdtObject instance for ServiceDefinition operations
     */
    getServiceDefinition() {
        this.assertConnected();
        return new serviceDefinition_1.AdtServiceDefinition(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for CDS Scalar Function (DSFD/SCF) objects
     */
    getScalarFunction() {
        this.assertConnected();
        return new scalarFunction_1.AdtScalarFunction(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for Scalar Function Implementation (DSFI/SFI) objects
     */
    getScalarFunctionImplementation() {
        this.assertConnected();
        return new scalarFunctionImplementation_1.AdtScalarFunctionImplementation(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for Append Structure (TABL/DS) objects
     */
    getAppendStructure() {
        this.assertConnected();
        return new appendStructure_1.AdtAppendStructure(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for ServiceBinding objects
     * @returns IAdtServiceBinding instance for ServiceBinding CRUD and lifecycle operations
     */
    getServiceBinding() {
        this.assertConnected();
        return new service_1.AdtServiceBinding(this.connection, this.logger, this.systemContext);
    }
    /**
     * @deprecated Use getServiceBinding() instead.
     */
    getService() {
        return this.getServiceBinding();
    }
    /**
     * Get high-level operations for BehaviorDefinition objects
     * @returns IAdtObject instance for BehaviorDefinition operations
     */
    getBehaviorDefinition() {
        this.assertConnected();
        return new behaviorDefinition_1.AdtBehaviorDefinition(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for BehaviorImplementation objects
     * @returns IAdtObject instance for BehaviorImplementation operations
     */
    getBehaviorImplementation() {
        this.assertConnected();
        return new behaviorImplementation_1.AdtBehaviorImplementation(this.connection, this.logger, this.lockRegistry);
    }
    /**
     * Get high-level operations for MetadataExtension objects
     * @returns IAdtObject instance for MetadataExtension operations
     */
    getMetadataExtension() {
        this.assertConnected();
        return new metadataExtension_1.AdtMetadataExtension(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for Enhancement objects
     * Supports multiple enhancement types:
     * - Enhancement Implementation (ENHO)
     * - BAdI Implementation
     * - Source Code Plugin (with source code)
     * - Enhancement Spot (ENHS)
     * - BAdI Enhancement Spot
     * @returns IAdtObject instance for Enhancement operations
     */
    getEnhancement() {
        this.assertConnected();
        return new enhancement_1.AdtEnhancement(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for FeatureToggle objects
     * @returns IFeatureToggleObject instance for FeatureToggle operations
     */
    getFeatureToggle() {
        this.assertConnected();
        return new featureToggle_1.AdtFeatureToggle(this.connection, this.logger, this.systemContext, this.lockRegistry);
    }
    /**
     * Get high-level operations for UnitTest objects.
     *
     * A test run is created and read, never edited: ADT exposes no update,
     * delete, activate, check, lock or version resource for one. The declared
     * type says so rather than promising thirteen methods of which nine throw.
     *
     * It also carries {@link IAdtTestRunnable} — starting a run and collecting
     * its outcome is the reason this handler exists, and until interfaces 13.1.0
     * no contract described it, so callers cast past the type to reach it.
     */
    getUnitTest() {
        this.assertConnected();
        return new unitTest_1.AdtUnitTest(this.connection, this.logger);
    }
    /**
     * Get high-level operations for CDS UnitTest objects.
     *
     * Same capability set as {@link getUnitTest}; the CDS-specific surface
     * (`checkCdsTestDoubles`, `getCdsViewName`) is on the concrete class.
     */
    getCdsUnitTest() {
        this.assertConnected();
        return new unitTest_1.AdtCdsUnitTest(this.connection, this.logger);
    }
    /**
     * Get high-level operations for Request (Transport Request) objects
     * @returns IAdtObject instance for Request operations
     */
    getRequest() {
        this.assertConnected();
        return new transport_1.AdtRequest(this.connection, this.logger, this.systemContext);
    }
    /**
     * Get utility functions (NOT CRUD operations)
     * Provides access to cross-cutting ADT utility functions:
     * - Search operations
     * - Where-used analysis
     * - Inactive objects management
     * - Group activation/deletion
     * - Object metadata and source code reading
     * - SQL queries and table contents
     *
     * @returns AdtUtils instance for utility operations
     */
    getUtils() {
        this.assertConnected();
        return new AdtUtils_1.AdtUtils(this.connection, this.logger);
    }
    /**
     * Get high-level operations for LocalTestClass objects
     * @returns IAdtObject instance for LocalTestClass operations
     */
    getLocalTestClass() {
        this.assertConnected();
        return new class_1.AdtLocalTestClass(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for LocalTypes objects
     * @returns IAdtObject instance for LocalTypes operations
     */
    getLocalTypes() {
        this.assertConnected();
        return new class_1.AdtLocalTypes(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for LocalDefinitions objects
     * @returns IAdtObject instance for LocalDefinitions operations
     */
    getLocalDefinitions() {
        this.assertConnected();
        return new class_1.AdtLocalDefinitions(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
    /**
     * Get high-level operations for LocalMacros objects
     * @returns IAdtObject instance for LocalMacros operations
     */
    getLocalMacros() {
        this.assertConnected();
        return new class_1.AdtLocalMacros(this.connection, this.logger, this.systemContext, this.contentTypes, this.lockRegistry);
    }
}
exports.AdtClient = AdtClient;
