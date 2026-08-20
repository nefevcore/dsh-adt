/**
 * Structured metadata editing for the DDIC object types whose content is NOT
 * plain source text but a metadata XML document: message classes (MSAG),
 * domains (DOMA), data elements (DTEL) and table types (TTYP).
 *
 * The wire formats mirror what the official ADT editors exchange (cross-
 * checked against `@mcp-abap-adt/adt-clients`, `abap-adt-api` and the ADT
 * editors' own PUT payloads):
 *
 *  - MSAG  `application/vnd.sap.adt.mc.messageclass+xml`
 *          root `<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass">`,
 *          messages as `<mc:messages mc:msgno=".." mc:msgtext=".."/>` elements;
 *          deletions travel as `<mc:deletedmessages …/>`.
 *  - DOMA  `application/vnd.sap.adt.domains.v2+xml`
 *          root `<doma:domain>`, technical data under `<doma:content>` →
 *          `<doma:typeInformation>`, fixed values under `<doma:fixValues>`.
 *  - DTEL  `application/vnd.sap.adt.dataelements.v2+xml`
 *          root `<dtel:dataElement>`, `<dtel:typeKind>`/`<dtel:typeName>`/
 *          `<dtel:dataType>`(+Length/Decimals), labels under `<dtel:labels>`.
 *  - TTYP  `application/vnd.sap.adt.tabletypes.v2+xml`
 *          root `<ttypes:tableType>`, row type `<ttyp:typeKind>`/
 *          `<ttyp:typeName>`, access `<ttyp:accessType>`, key `<ttyp:definition>`.
 *
 * Writes use the read-modify-write pattern: the client GETs the current XML,
 * patches ONLY the explicitly-provided fields on the raw string (preserving
 * every SAP-managed attribute that would be lost in a from-scratch build),
 * and PUTs the result back under a lock handle.
 */
import type { AdtStructureChanges, AdtStructureData, AdtStructureKind } from './types.js';
/** Negotiation media type per structured kind (Accept + PUT Content-Type). */
export declare function structureMediaType(kind: AdtStructureKind): string;
/** Object type code (ADT form) per structured kind. */
export declare function structureTypeCode(kind: AdtStructureKind): string;
/** Parse a structured-metadata XML body into typed JSON (per kind). */
export declare function parseStructure(xml: string, kind: AdtStructureKind): AdtStructureData;
/**
 * Apply typed changes to a raw structured-metadata XML body. Only explicitly
 * provided fields are patched; everything else round-trips untouched.
 */
export declare function patchStructureXml(xml: string, kind: AdtStructureKind, changes: AdtStructureChanges): string;
//# sourceMappingURL=structure.d.ts.map