/** One connection discovered in the SAP GUI landscape. */
export interface SapGuiConnection {
    uuid: string;
    name: string;
    systemId?: string;
    kind: 'direct' | 'group' | 'reference';
    /** Folder path inside SAP Logon (workspace / node names), when found. */
    folder?: string;
    /** Direct/reference: application server host. */
    host?: string;
    /** Direct/reference: instance number ('00'..'99'). */
    sysnr?: string;
    /** Logon client (reference entries). */
    client?: string;
    /** Stored user (reference entries — SAP GUI keeps it per shortcut). */
    user?: string;
    language?: string;
    /** Reference entries: uuid of the linked SAPGUI service. */
    link?: string;
    /** Saprouter string of the service, when routed (informational). */
    router?: string;
    /** Group entries: logon group + message server host. */
    groupName?: string;
    msHost?: string;
    /** Derived ADT base URL (HTTPS port convention); undefined when not derivable. */
    adtUrl?: string;
    /** Plain-HTTP alternative (ICF on port 80<nn>). */
    httpUrl?: string;
    /** Why no URL, or caveats about the derived one. */
    adtUrlNote?: string;
    /** File the entry was read from. */
    source: string;
}
/** Aggregate discovery result. */
interface SapGuiLandscape {
    /** Files actually read (absolute paths). */
    sources: string[];
    connections: SapGuiConnection[];
}
/** Instance number from a DIAG port (3200 -> '00', 3201 -> '01'); undefined otherwise. */
export declare function sysnrFromDiagPort(port: number | undefined): string | undefined;
/** host:port splitter for the `server` attribute. */
export declare function splitServer(server: string): {
    host: string;
    port?: number;
};
/**
 * Derive ADT URLs from host + instance number: ICF serves /sap/bc/adt on
 * 443<nn> (HTTPS) and 80<nn> (HTTP) on the application server.
 */
export declare function adtUrlsFor(host: string, sysnr: string | undefined): {
    adtUrl?: string;
    httpUrl?: string;
};
/**
 * Discover and parse the SAP GUI landscape. Unresolvable files are skipped
 * silently (discovery must degrade to "no GUI found"); parse ERRORS in a file
 * that exists surface as a note on the result instead of throwing, so one
 * broken backup file cannot break discovery.
 */
export declare function discoverSapGuiLandscape(): SapGuiLandscape;
/**
 * Case-insensitive search over the landscape. The query is split on
 * whitespace into terms; EVERY term must match at least one field (name,
 * system id, folder, client, stored user, group, message server) — so
 * "impc qas" finds systems whose name/folder mention both. Empty query
 * returns everything.
 */
export declare function searchSapGuiConnections(connections: SapGuiConnection[], query?: string): SapGuiConnection[];
export {};
//# sourceMappingURL=sapgui.d.ts.map