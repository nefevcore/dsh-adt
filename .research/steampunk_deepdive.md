# Native ADT Features Deep Dive

**Date:** 2025-12-05
**Report ID:** 005
**Subject:** Comprehensive analysis of native ADT REST API features available for implementation
**Related Documents:** adt-toolset-analysis.md, adt-abap-internals-documentation.md

---

## Executive Summary

This report documents all native ADT features discovered through SAP system analysis that could be implemented in vsp. The research reveals **15+ major feature areas** with REST API support that are not yet implemented.

---

## 1. Short Dumps / Runtime Errors (RABAX)

**Package:** `SABP_RABAX_ADT`
**Application Title:** "ABAP Runtime Errors"
**Priority:** HIGH

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/sap/bc/adt/runtime/dumps` | CL_RABAX_ADT_RES_DUMPS | List all dumps (feed) |
| `/sap/bc/adt/runtime/dumps/{id}` | CL_RABAX_ADT_RES_DUMP | Get single dump |
| `/sap/bc/adt/runtime/dumps/{id}/{part}` | CL_RABAX_ADT_RES_DUMP | Get dump part (stack, variables, etc.) |

### Key Classes
- `CL_RABAX_ADT_RES_APP` - Resource application router
- `CL_RABAX_ADT_RES_DUMPS` - Dump list (Atom feed)
- `CL_RABAX_ADT_RES_DUMP` - Single dump details
- `CL_RABAX_ADT_SNAP` - SNAP table access

### Features
- Query dumps by: user, runtime error type, exception, datetime, package
- FQL (Filter Query Language) support for complex queries
- Paging support (max 100 per page)
- HTML rendering of dump details
- Atom feed format for notification integration

### Proposed Tools
```
GetDumps        - List runtime errors with filters
GetDump         - Get single dump details with full stack trace
```

---

## 2. ABAP Profiler / Runtime Traces (ATRA)

**Package:** `S_ATRA_ADT`
**Application Title:** "ABAP Profiler"
**Priority:** HIGH

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/runtime/traces/abaptraces` | CL_ATRADT_TRACES_RES_TRACES | List trace files |
| `/runtime/traces/abaptraces/{trace_id}` | CL_ATRADT_TRACES_RES_TRACES | Get trace |
| `/runtime/traces/abaptraces/{trace_id}/{tool}` | CL_ATRADT_TRACES_RES_TRACES | Get trace analysis |
| `/runtime/traces/abaptraces/parameters` | CL_ATRADT_TRACES_RES_PARAMS | Trace parameters |
| `/runtime/traces/abaptraces/requests` | CL_ATRADT_TRACES_RES_REQS | Trace requests |
| `/runtime/traces/abaptraces/objecttypes` | CL_ATRADT_OBJECT_TYPES | Object types list |
| `/runtime/traces/abaptraces/processtypes` | CL_ATRADT_PROCESS_TYPES | Process types list |

### Tool Parameters (for `{tool}`)
- `statements` - Statement-level trace
- `hitlist` - Hit list analysis
- `dbAccesses` - Database access analysis
- `amdp` - AMDP trace
- `binary` - Raw trace file (ZIP)

### Features
- Start/stop trace recording
- Callstack aggregation
- AMDP (HANA procedure) tracing
- Trace file upload/download

### Proposed Tools
```
ListTraces      - List available trace files
GetTrace        - Get trace analysis (hitlist, statements, dbAccesses)
StartTrace      - Start trace recording
StopTrace       - Stop trace recording
```

---

## 3. SQL Trace (ST05)

**Package:** `S_PERFORMANCE_TOOLS_ADT`
**Application Title:** "Performance Trace"
**Priority:** MEDIUM

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/st05/trace/state` | CL_ADT_ST05_TRACE_STATE | Trace state (on/off) |
| `/st05/trace/directory` | CL_ADT_ST05_TRACE_DIRECTORY | Trace directory listing |

### Key Classes
- `CL_ADT_ST05_RES_APP` - Resource application
- `CL_ADT_ST05_TRACE_STATE` - Control trace state
- `CL_ADT_ST05_TRACE_DIRECTORY` - List traces
- `CL_ADT_ST05_KERNEL_INTERFACE` - Kernel interface

### Proposed Tools
```
GetSQLTraceState    - Check if SQL trace is active
SetSQLTraceState    - Start/stop SQL trace
ListSQLTraces       - List SQL trace results
```

---

## 4. ABAP Test Cockpit (ATC)

**Package:** `SATC_ABAP_CHECK_ADT`
**Application Title:** "ABAP Test Cockpit"
**Priority:** HIGH

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/atc/runs` | CL_SATC_ADT_RES_ATC_RUNS | Start ATC run |
| `/atc/runs/{projectId}` | CL_SATC_ADT_RES_ATC_RUN | Get run status |
| `/atc/results` | CL_SATC_ADT_RES_RESULTS | List results |
| `/atc/results/{displayId}` | CL_SATC_ADT_RES_RESULT | Get result details |
| `/atc/worklists` | CL_SATC_ADT_RES_WORKLIST | Worklist management |
| `/atc/worklists/{worklistId}` | CL_SATC_ADT_RES_WORKLIST | Get worklist |
| `/atc/customizing` | CL_SATC_ADT_RES_CUSTOMIZING | ATC configuration |
| `/atc/variants` | CL_SATC_ADT_VARIANT_NIS | Check variants |
| `/atc/exemptions/apply` | CL_SATC_ADT_RES_EXEMPTION | Exemption handling |
| `/atc/autoqf/worklist` | CL_SATC_ADT_RES_AUTOQUICKFIX | Auto quickfix |
| `/atc/checkfailures` | CL_SATC_ADT_RES_CHECK_FAILURE | Check failures |

### Features
- Run ATC checks on objects/packages
- Worklist mode for incremental checking
- Check variants selection
- Exemption management
- Auto-quickfix proposals
- Central check system support

### Proposed Tools
```
RunATCCheck         - Run ATC on object/package
GetATCResults       - Get ATC findings
GetATCWorklist      - Get/create worklist
ApplyATCExemption   - Apply exemption to finding
GetATCQuickfixes    - Get quickfix proposals
```

---

## 5. Transport Management (CTS)

**Package:** `SCTS_ADT`
**Application Title:** "Change and Transport System"
**Priority:** HIGH (partially implemented)

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/cts/transports` | CL_CTS_ADT_RES_OBJ_RECORD | Create/query transports |
| `/cts/transports/{requestnumber}` | CL_CTS_ADT_RES_OBJ_RECORD | Get transport |
| `/cts/transportchecks` | CL_CTS_ADT_RES_CHECK | Transport checks |
| `/cts/transportrequests` | CL_CTS_ADT_TM_RES_COLL_CONT | Transport organizer |
| `/cts/transportrequests/{trnumber}` | CL_CTS_ADT_TM_RES_REQUEST_CONT | Get request details |
| `/cts/transportrequests/{trnumber}/{action}` | CL_CTS_ADT_TM_RES_COLL_CONT | Perform action |
| `/cts/transportrequests/{trnumber}/checkruns` | CL_CTS_ADT_TM_CHECKRUN_SERVICE | Run checks |
| `/cts/transportrequests/{trnumber}/transportlogs` | CL_CTS_ADT_TM_TRANSPORT_LOGS | Get logs |
| `/cts/transportrequests/{trnumber}/actionlogs` | CL_CTS_ADT_TM_ACTION_LOGS | Action logs |
| `/cts/transportrequests/facets` | CL_CTS_ADT_TM_FACETS_RES | Supported facets |

### Actions Available
- Release
- Check
- Import
- Delete objects
- Add objects

### Already Implemented
- GetTransportRequests
- CreateTransportRequest
- ReleaseTransportRequest
- AddToTransportRequest

### Missing Features
- Transport logs viewing
- Check runs
- Import status
- Action logs

---

## 6. Code Analysis Infrastructure (CAI) - Call Graph

**Package:** `SCAI_ADT`
**Application Title:** "Code Analysis Infrastructure"
**Priority:** MEDIUM

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/cai/callgraph` | CL_CAI_ADT_RES_CALLGRAPH | Call graph service |
| `/cai/callgraph/aspectactivations` | CL_CAI_ADT_ASPECT_ACTIVATIONS | Graph aspects |
| `/cai/objectexplorer` | CL_CAI_ADT_RES_OBJECT_EXPLORER | Object structure |
| `/cai/objectexplorer/{fullname}/children` | CL_CAI_ADT_RES_OBJECT_EXPLORER | Child objects |
| `/cai/objectexplorer/{fullname}/entrypoints` | CL_CAI_ADT_RES_OBJECT_EXPLORER | Entry points |
| `/cai/objectexplorer/{fullname}/parents` | CL_CAI_ADT_RES_OBJECT_EXPLORER | Parent objects |
| `/cai/objectreferences` | CL_CAI_ADT_RES_OBJECT_REFS | Object references |
| `/cai/programfields` | CL_CAI_ADT_RES_PROGRAM_FIELDS | Program fields |
| `/cai/screens` | CL_CAI_ADT_RES_SCREENS | Screens |
| `/cai/screenfields` | CL_CAI_ADT_RES_SCREEN_FIELDS | Screen fields |

### Requirements
- Requires `CAI_ADT` SET/GET parameter to be enabled

### Proposed Tools
```
GetCallGraph        - Get call hierarchy for method/function
GetObjectStructure  - Get object explorer tree
GetObjectReferences - Get references at position
```

---

## 7. API Release State (ARS)

**Package:** `S_ARS_ADT`
**Application Title:** "API Releases"
**Priority:** LOW

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/apireleases` | CL_ARS_ADT_RES_API_REL | API release info |
| `/apireleases/{uri}` | CL_ARS_ADT_RES_API_REL | Get release state |
| `/apireleases/{uri}/{contract}` | CL_ARS_ADT_RES_CONTRACT | Contract info |
| `/apireleases/meta` | CL_ARS_ADT_RES_API_REL_META | Metadata |
| `/apireleases/meta/supportedcontracts` | CL_ARS_ADT_RES_API_REL_META | Supported contracts |

### Proposed Tools
```
GetAPIReleaseState  - Get release state for object (C0, C1, C2)
```

---

## 8. System Information

**Package:** `SADT_UTILITIES`
**Application Title:** "System Information"
**Priority:** MEDIUM

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/system/information` | CL_ADT_RES_SYSTEM_INFORMATION | System info |
| `/system/components` | CL_ADT_RES_INSTALLED_COMPONENT | Installed components |
| `/system/users` | CL_ADT_RES_USERS | User query |
| `/system/users/{username}` | CL_ADT_RES_USERS | Get user details |

### Proposed Tools
```
GetSystemInfo       - Get system information (SID, client, release)
GetInstalledComponents - List installed software components
GetUser             - Get user details
SearchUsers         - Search users
```

---

## 9. Data Preview (Enhanced)

**Package:** `SDP_ADT`
**Application Title:** "Data Preview"
**Priority:** MEDIUM (partially implemented via RunQuery)

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/datapreview/ddic` | CL_ADT_DATAPREVIEW_RES | DDIC entity preview |
| `/datapreview/ddic/{name}/metadata` | CL_ADT_DATAPREVIEW_RES | Get metadata |
| `/datapreview/cds` | CL_ADT_DP_CDS_RES | CDS view preview |
| `/datapreview/cds/{name}/metadata` | CL_ADT_DP_CDS_RES | CDS metadata |
| `/datapreview/freestyle` | CL_ADT_DP_FREESTYLE_RES | Freestyle SQL |
| `/datapreview/amdp` | CL_ADT_AMDP_DATAPREVIEW_RES | AMDP preview |
| `/datapreview/amdpdebugger` | CL_ADT_DP_DBG_AMDP_RES | AMDP debugger preview |

### Features
- Association navigation for CDS
- Column metadata
- Data aging support
- Pretty printer for SQL

---

## 10. AMDP Debugger

**Package:** `SABP_AMDP_DBG_ADT`
**Application Title:** "AMDP Debugger for ADT"
**Priority:** LOW (requires HANA)

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/amdp/debugger/main` | CL_AMDP_DBG_ADT_RES_MAIN | Main debugger |
| `/amdp/debugger/main/{mainId}` | CL_AMDP_DBG_ADT_RES_MAIN | Session |
| `/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}` | CL_AMDP_DBG_ADT_RES_DEBUGGEE | Debuggee |
| `/amdp/debugger/main/{mainId}/breakpoints` | CL_AMDP_DBG_ADT_BREAKPOINTS | Breakpoints |
| `/amdp/debugger/main/{mainId}/debuggees/{debuggeeId}/variables/{varname}` | CL_AMDP_DBG_ADT_RES_VARS | Variables |

### Features
- Start/terminate debug session
- Set breakpoints
- Step over/continue
- Variable inspection
- GTT (Global Temporary Table) access

---

## 11. ABAP Logs

**Package:** `SADT_UTILITIES`
**Application Title:** "ABAP Logs"
**Priority:** LOW

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/logs/{type}/{name}` | CL_ADT_RES_ABAP_LOGS | Get logs for object |

---

## 12. Feed Repository

**Package:** `SADT_FEED_REPOSITORY`
**Priority:** LOW

### Endpoints

| Endpoint | Handler Class | Description |
|----------|--------------|-------------|
| `/feeds` | CL_ADT_RES_FEED_REPOSITORY | Feed repository |
| `/feeds/icons` | CL_ADT_RES_FEED_ICONS | Feed icons |
| `/feeds/variants` | CL_ADT_RES_FEED_VARIANTS | Feed variants |

---

## Implementation Priority Matrix

| Feature | Priority | Complexity | Value | Status |
|---------|----------|------------|-------|--------|
| Short Dumps (RABAX) | HIGH | Medium | High | Not Started |
| ABAP Profiler (ATRA) | HIGH | High | High | Not Started |
| ATC Checks | HIGH | Medium | Very High | Not Started |
| SQL Trace (ST05) | MEDIUM | Medium | Medium | Not Started |
| Transport Logs | MEDIUM | Low | Medium | Not Started |
| Call Graph (CAI) | MEDIUM | Medium | High | Not Started |
| System Info | MEDIUM | Low | Medium | Not Started |
| API Release State | LOW | Low | Low | Not Started |
| AMDP Debugger | LOW | Very High | Low | Not Started |
| ABAP Logs | LOW | Low | Low | Not Started |

---

## Proposed Tool Summary

### Phase 1: Core Analysis Tools (12 tools)
```
# Short Dumps
GetDumps            - List runtime errors
GetDump             - Get dump details

# ABAP Profiler
ListTraces          - List trace files
GetTrace            - Get trace analysis
StartTrace          - Start recording
StopTrace           - Stop recording

# ATC
RunATCCheck         - Run ATC check
GetATCResults       - Get findings
GetATCWorklist      - Manage worklist

# System
GetSystemInfo       - System information
GetInstalledComponents - Software components
SearchUsers         - User search
```

### Phase 2: Advanced Features (8 tools)
```
# SQL Trace
GetSQLTraceState    - Check trace status
SetSQLTraceState    - Control trace
ListSQLTraces       - List results

# Call Graph
GetCallGraph        - Call hierarchy
GetObjectStructure  - Object tree

# Transport (extend existing)
GetTransportLogs    - View logs
RunTransportCheck   - Run checks

# API State
GetAPIReleaseState  - Release state
```

---

## Technical Notes

### Authentication
All endpoints use standard ADT authentication (Basic Auth or Cookie).

### Content Types
Most endpoints support:
- `application/atom+xml` - Atom feeds
- `application/xml` - XML responses
- `application/json` - JSON (some endpoints)

### Common Patterns
1. **Feed endpoints** - Use FQL (Filter Query Language) for queries
2. **Discovery** - All features discoverable via `/sap/bc/adt/discovery`
3. **Resource pattern** - Collection (`/items`) + Single (`/items/{id}`)

---

## Conclusion

SAP ADT provides extensive REST API coverage for development and analysis tools. The most valuable additions would be:

1. **Short Dumps** - Critical for debugging production issues
2. **ATC Integration** - Essential for code quality
3. **ABAP Profiler** - Performance analysis
4. **Call Graph** - Code navigation and impact analysis

These features would significantly enhance vsp's utility for ABAP development and DevOps scenarios.

---

## Appendix: Package Reference

| Package | Description | Classes |
|---------|-------------|---------|
| SABP_RABAX_ADT | Runtime Errors | CL_RABAX_ADT_* |
| S_ATRA_ADT | ABAP Profiler | CL_ATRADT_* |
| S_PERFORMANCE_TOOLS_ADT | SQL Trace | CL_ADT_ST05_* |
| SATC_ABAP_CHECK_ADT | ATC | CL_SATC_ADT_* |
| SCTS_ADT | Transport System | CL_CTS_ADT_* |
| SCAI_ADT | Code Analysis | CL_CAI_ADT_* |
| S_ARS_ADT | API Release | CL_ARS_ADT_* |
| SADT_UTILITIES | Utilities | CL_ADT_RES_* |
| SDP_ADT | Data Preview | CL_ADT_*PREVIEW* |
| SABP_AMDP_DBG_ADT | AMDP Debug | CL_AMDP_DBG_* |
