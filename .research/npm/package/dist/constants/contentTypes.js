"use strict";
/**
 * Centralized ADT content type constants
 *
 * Convention:
 * - ACCEPT_* — Accept headers (may include version fallback via commas)
 * - CT_*     — Content-Type headers (single specific version)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCEPT_AUTHORIZATION_FIELD = exports.CT_DOMAIN = exports.ACCEPT_DOMAIN = exports.CT_TABLE_TYPE = exports.ACCEPT_TABLE_TYPE = exports.CT_TABLE = exports.ACCEPT_TABLE = exports.CT_FUNCTION_INCLUDE = exports.ACCEPT_FUNCTION_INCLUDE = exports.CT_FUNCTION_MODULE = exports.ACCEPT_FUNCTION_MODULE = exports.CT_FUNCTION_GROUP = exports.ACCEPT_FUNCTION_GROUP = exports.CT_PROGRAM = exports.ACCEPT_PROGRAM = exports.CT_INTERFACE = exports.ACCEPT_INTERFACE = exports.CT_CLASS = exports.ACCEPT_CLASS = exports.ACCEPT_DATA_PREVIEW = exports.CT_WHERE_USED_SCOPE = exports.ACCEPT_WHERE_USED_SCOPE = exports.CT_WHERE_USED_REQUEST = exports.ACCEPT_WHERE_USED_RESULT = exports.CT_VIRTUAL_FOLDERS = exports.ACCEPT_VIRTUAL_FOLDERS = exports.ACCEPT_NODE_STRUCTURE = exports.ACCEPT_DISCOVERY = exports.ACCEPT_JUNIT_RESULT = exports.ACCEPT_UNIT_TEST_RESULT = exports.ACCEPT_UNIT_TEST_STATUS = exports.CT_UNIT_TEST_RUN = exports.CT_TRANSPORT_CHECK = exports.ACCEPT_TRANSPORT_CHECK = exports.ACCEPT_TRANSPORT_LIST = exports.ACCEPT_TRANSPORT = exports.ACCEPT_VALIDATION = exports.CT_ACTIVATION = exports.ACCEPT_ACTIVATION = exports.CT_DELETION = exports.ACCEPT_DELETION = exports.CT_DELETION_CHECK = exports.ACCEPT_DELETION_CHECK = exports.CT_CHECK_OBJECTS = exports.ACCEPT_CHECK_MESSAGES = exports.ACCEPT_LOCK = exports.CT_SOURCE = exports.ACCEPT_SOURCE_XML_FALLBACK = exports.ACCEPT_SOURCE_UTF8 = exports.ACCEPT_SOURCE = void 0;
exports.ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2 = exports.CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2 = exports.CT_ABAPGIT_REPO_OBJECT_V2 = exports.ACCEPT_ABAPGIT_REPOS_V2 = exports.CT_ABAPGIT_REPO_V4 = exports.CT_ABAPGIT_REPO_V3 = exports.MESSAGE_CLASS_UPDATE_CONTENT_TYPE = exports.ACCEPT_FEATURE_TOGGLE_SOURCE = exports.CT_FEATURE_TOGGLE_SOURCE = exports.CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS = exports.CT_FEATURE_TOGGLE_CHECK_PARAMETERS = exports.ACCEPT_FEATURE_TOGGLE_CHECK_RESULT = exports.ACCEPT_FEATURE_TOGGLE_STATES = exports.CT_FEATURE_TOGGLE_METADATA = exports.ACCEPT_FEATURE_TOGGLE_METADATA = exports.ACCEPT_SYSTEM_INFO = exports.CT_TRACE_PARAMETERS = exports.ACCEPT_TRACE_CALLTREE = exports.ACCEPT_TRACE_FEED = exports.ACCEPT_TRACE_XML = exports.ACCEPT_VALIDATION_CLASS_NAME = exports.CT_ENHANCEMENT = exports.ACCEPT_ENHANCEMENT = exports.CT_TRANSFORMATION = exports.ACCEPT_TRANSFORMATION = exports.CT_ACCESS_CONTROL = exports.CT_METADATA_EXTENSION = exports.CT_SERVICE_DEFINITION = exports.CT_BEHAVIOR_DEFINITION = exports.CT_PACKAGE = exports.ACCEPT_PACKAGE = exports.ACCEPT_APPEND_STRUCTURE = exports.CT_SCALAR_FUNCTION_IMPL_SOURCE = exports.ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE = exports.ACCEPT_SCALAR_FUNCTION_IMPL = exports.CT_SCALAR_FUNCTION_IMPL_UPDATE = exports.CT_SCALAR_FUNCTION_IMPL = exports.CT_SCALAR_FUNCTION = exports.ACCEPT_SCALAR_FUNCTION = exports.CT_VIEW = exports.ACCEPT_VIEW_METADATA = exports.ACCEPT_VIEW = exports.CT_STRUCTURE = exports.ACCEPT_STRUCTURE = exports.CT_DATA_ELEMENT = exports.ACCEPT_DATA_ELEMENT = exports.CT_AUTHORIZATION_FIELD = void 0;
// =============================================================================
// Cross-cutting (shared across object types)
// =============================================================================
// Source code
exports.ACCEPT_SOURCE = 'text/plain';
exports.ACCEPT_SOURCE_UTF8 = 'text/plain; charset=utf-8';
exports.ACCEPT_SOURCE_XML_FALLBACK = 'text/plain, application/xml';
exports.CT_SOURCE = 'text/plain; charset=utf-8';
// Lock
exports.ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
// Check
exports.ACCEPT_CHECK_MESSAGES = 'application/vnd.sap.adt.checkmessages+xml';
exports.CT_CHECK_OBJECTS = 'application/vnd.sap.adt.checkobjects+xml';
// Deletion
exports.ACCEPT_DELETION_CHECK = 'application/vnd.sap.adt.deletion.check.response.v1+xml';
exports.CT_DELETION_CHECK = 'application/vnd.sap.adt.deletion.check.request.v1+xml';
exports.ACCEPT_DELETION = 'application/vnd.sap.adt.deletion.response.v1+xml';
exports.CT_DELETION = 'application/vnd.sap.adt.deletion.request.v1+xml';
// Activation
exports.ACCEPT_ACTIVATION = 'application/xml';
exports.CT_ACTIVATION = 'application/vnd.sap.adt.activation+xml';
// Validation
exports.ACCEPT_VALIDATION = 'application/vnd.sap.as+xml';
// Transport
exports.ACCEPT_TRANSPORT = 'application/vnd.sap.adt.transportorganizer.v1+xml';
exports.ACCEPT_TRANSPORT_LIST = 'application/vnd.sap.adt.transportorganizertree.v1+xml';
exports.ACCEPT_TRANSPORT_CHECK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData';
exports.CT_TRANSPORT_CHECK = 'application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData';
// Unit Test
exports.CT_UNIT_TEST_RUN = 'application/vnd.sap.adt.api.abapunit.run.v2+xml';
exports.ACCEPT_UNIT_TEST_STATUS = 'application/vnd.sap.adt.api.abapunit.run-status.v1+xml';
exports.ACCEPT_UNIT_TEST_RESULT = 'application/vnd.sap.adt.api.abapunit.run-result.v1+xml';
exports.ACCEPT_JUNIT_RESULT = 'application/vnd.sap.adt.api.junit.run-result.v1+xml';
// Discovery
exports.ACCEPT_DISCOVERY = 'application/atomsvc+xml';
// Repository
exports.ACCEPT_NODE_STRUCTURE = 'application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml';
// Virtual Folders
exports.ACCEPT_VIRTUAL_FOLDERS = 'application/vnd.sap.adt.repository.virtualfolders.result.v1+xml';
exports.CT_VIRTUAL_FOLDERS = 'application/vnd.sap.adt.repository.virtualfolders.request.v1+xml';
// Where-Used
exports.ACCEPT_WHERE_USED_RESULT = 'application/vnd.sap.adt.repository.usagereferences.result.v1+xml';
exports.CT_WHERE_USED_REQUEST = 'application/vnd.sap.adt.repository.usagereferences.request.v1+xml';
exports.ACCEPT_WHERE_USED_SCOPE = 'application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml';
exports.CT_WHERE_USED_SCOPE = 'application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml';
// Data Preview
exports.ACCEPT_DATA_PREVIEW = 'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml';
// =============================================================================
// Per-object-type (metadata read/create)
// =============================================================================
// Classes
exports.ACCEPT_CLASS = 'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes.v3+xml, application/vnd.sap.adt.oo.classes.v2+xml, application/vnd.sap.adt.oo.classes.v1+xml';
exports.CT_CLASS = 'application/vnd.sap.adt.oo.classes.v4+xml';
// Interfaces
exports.ACCEPT_INTERFACE = 'application/vnd.sap.adt.oo.interfaces.v5+xml, application/vnd.sap.adt.oo.interfaces.v4+xml, application/vnd.sap.adt.oo.interfaces.v3+xml, application/vnd.sap.adt.oo.interfaces.v2+xml, application/vnd.sap.adt.oo.interfaces+xml';
exports.CT_INTERFACE = 'application/vnd.sap.adt.oo.interfaces.v5+xml';
// Programs
exports.ACCEPT_PROGRAM = 'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs.v1+xml';
exports.CT_PROGRAM = 'application/vnd.sap.adt.programs.programs.v2+xml';
// Function Groups
exports.ACCEPT_FUNCTION_GROUP = 'application/vnd.sap.adt.functions.groups.v2+xml, application/vnd.sap.adt.functions.groups.v1+xml';
exports.CT_FUNCTION_GROUP = 'application/vnd.sap.adt.functions.groups.v3+xml';
// Function Modules
exports.ACCEPT_FUNCTION_MODULE = 'application/vnd.sap.adt.functions.fmodules+xml, application/vnd.sap.adt.functions.fmodules.v2+xml, application/vnd.sap.adt.functions.fmodules.v3+xml';
exports.CT_FUNCTION_MODULE = 'application/vnd.sap.adt.functions.fmodules+xml';
// Function Includes (FUGR/I)
exports.ACCEPT_FUNCTION_INCLUDE = 'application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml';
exports.CT_FUNCTION_INCLUDE = 'application/vnd.sap.adt.functions.fincludes.v2+xml';
// Tables
exports.ACCEPT_TABLE = 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml';
exports.CT_TABLE = 'application/vnd.sap.adt.tables.v2+xml';
// Table Types
exports.ACCEPT_TABLE_TYPE = 'application/vnd.sap.adt.tabletypes.v2+xml, application/vnd.sap.adt.tabletypes.v1+xml, application/vnd.sap.adt.blues.v1+xml';
exports.CT_TABLE_TYPE = 'application/vnd.sap.adt.tabletype.v1+xml';
// Domains
exports.ACCEPT_DOMAIN = 'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml';
exports.CT_DOMAIN = 'application/vnd.sap.adt.domains.v2+xml';
// Authorization Fields (SUSO / AUTH)
// Shared blues envelope used by APS IAM auth endpoints
exports.ACCEPT_AUTHORIZATION_FIELD = 'application/vnd.sap.adt.blues.v1+xml';
exports.CT_AUTHORIZATION_FIELD = 'application/vnd.sap.adt.blues.v1+xml';
// Data Elements
exports.ACCEPT_DATA_ELEMENT = 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml';
exports.CT_DATA_ELEMENT = 'application/vnd.sap.adt.dataelements.v2+xml';
// Structures
exports.ACCEPT_STRUCTURE = 'application/vnd.sap.adt.structures.v2+xml, application/vnd.sap.adt.structures.v1+xml';
exports.CT_STRUCTURE = 'application/vnd.sap.adt.structures.v2+xml';
// Views (CDS DDLS)
exports.ACCEPT_VIEW = 'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml';
exports.ACCEPT_VIEW_METADATA = 'application/vnd.sap.adt.ddlSource+xml';
exports.CT_VIEW = 'application/vnd.sap.adt.ddlSource+xml';
// Scalar Functions (CDS DSFD/SCF) — uses the shared blues envelope
exports.ACCEPT_SCALAR_FUNCTION = 'application/vnd.sap.adt.blues.v1+xml';
exports.CT_SCALAR_FUNCTION = 'application/vnd.sap.adt.blues.v1+xml';
// Scalar Function Implementations (DSFI/SFI) — blues v2 envelope
exports.CT_SCALAR_FUNCTION_IMPL = 'application/vnd.sap.adt.blues.v2+xml';
exports.CT_SCALAR_FUNCTION_IMPL_UPDATE = 'application/vnd.sap.adt.blues.v2+xml; charset=utf-8';
exports.ACCEPT_SCALAR_FUNCTION_IMPL = 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml';
// Source endpoint (/source/main) — JSON for both read and implementation update
exports.ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE = 'application/json';
exports.CT_SCALAR_FUNCTION_IMPL_SOURCE = 'application/json';
// Append Structures (TABL/DS) — blues envelope, structures media type for create
exports.ACCEPT_APPEND_STRUCTURE = 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml';
// Packages
exports.ACCEPT_PACKAGE = 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml';
exports.CT_PACKAGE = 'application/vnd.sap.adt.packages.v2+xml';
// Behavior Definitions
exports.CT_BEHAVIOR_DEFINITION = 'application/vnd.sap.adt.blues.v1+xml';
// Service Definitions
exports.CT_SERVICE_DEFINITION = 'application/vnd.sap.adt.ddic.srvd.v1+xml';
// Metadata Extensions
exports.CT_METADATA_EXTENSION = 'application/vnd.sap.adt.ddic.ddlx.v1+xml';
// Access Controls
exports.CT_ACCESS_CONTROL = 'application/vnd.sap.adt.dclSource+xml';
// Transformations (XSLT)
exports.ACCEPT_TRANSFORMATION = 'application/vnd.sap.adt.transformations+xml';
exports.CT_TRANSFORMATION = 'application/vnd.sap.adt.transformations+xml';
// Enhancements
exports.ACCEPT_ENHANCEMENT = 'application/vnd.sap.adt.enhancements.v1+xml, application/xml';
exports.CT_ENHANCEMENT = 'application/vnd.sap.adt.enhancements.v1+xml';
// =============================================================================
// Validation (per-object-type)
// =============================================================================
exports.ACCEPT_VALIDATION_CLASS_NAME = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.oo.clifname.check';
// Profiler Traces
exports.ACCEPT_TRACE_XML = 'application/xml';
exports.ACCEPT_TRACE_FEED = 'application/atom+xml;type=feed';
exports.ACCEPT_TRACE_CALLTREE = 'application/vnd.sap.adt.runtime.traces.abaptraces.aggcalltree+xml, application/xml';
exports.CT_TRACE_PARAMETERS = 'application/xml';
// System Information
exports.ACCEPT_SYSTEM_INFO = 'application/json';
// Feature Toggles (FTG2/FT) — metadata uses the shared blues envelope
// same as APS IAM; state and domain endpoints use dedicated JSON types.
exports.ACCEPT_FEATURE_TOGGLE_METADATA = 'application/vnd.sap.adt.blues.v1+xml';
exports.CT_FEATURE_TOGGLE_METADATA = 'application/vnd.sap.adt.blues.v1+xml';
exports.ACCEPT_FEATURE_TOGGLE_STATES = 'application/vnd.sap.adt.states.v1+asjson';
exports.ACCEPT_FEATURE_TOGGLE_CHECK_RESULT = 'application/vnd.sap.adt.toggle.check.result.v1+asjson';
exports.CT_FEATURE_TOGGLE_CHECK_PARAMETERS = 'application/vnd.sap.adt.toggle.check.parameters.v1+asjson';
exports.CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS = 'application/vnd.sap.adt.related.toggle.parameters.v1+asjson';
exports.CT_FEATURE_TOGGLE_SOURCE = 'application/vnd.sap.adt.toggle.content.v2+json';
exports.ACCEPT_FEATURE_TOGGLE_SOURCE = exports.CT_FEATURE_TOGGLE_SOURCE;
// Message Classes (MSAG/N)
exports.MESSAGE_CLASS_UPDATE_CONTENT_TYPE = 'application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8';
// abapGit (/sap/bc/adt/abapgit/*)
// Envelope for the repository entity (sapcli parity: v3; v4 advertised
// in discovery but kept opt-in via IAdtAbapGitClientOptions.contentTypeVersion).
exports.CT_ABAPGIT_REPO_V3 = 'application/abapgit.adt.repo.v3+xml';
exports.CT_ABAPGIT_REPO_V4 = 'application/abapgit.adt.repo.v4+xml';
// Accept for the repo list (sapcli uses v2; v4 advertised in discovery).
exports.ACCEPT_ABAPGIT_REPOS_V2 = 'application/abapgit.adt.repos.v2+xml';
// Accept/Content-Type for the error log (sapcli parity).
exports.CT_ABAPGIT_REPO_OBJECT_V2 = 'application/abapgit.adt.repo.object.v2+xml';
// External-repo probe — Phase Z confirmed that request and response
// use different media-type families (request vs response sub-path).
exports.CT_ABAPGIT_EXTERNAL_REPO_INFO_REQUEST_V2 = 'application/abapgit.adt.repo.info.ext.request.v2+xml';
exports.ACCEPT_ABAPGIT_EXTERNAL_REPO_INFO_RESPONSE_V2 = 'application/abapgit.adt.repo.info.ext.response.v2+xml';
