/**
 * ADT Content-Type / Accept header provider
 *
 * Base class provides v1 headers (universal, works on all systems).
 * Modern subclass overrides with v2+ for newer systems (S/4 HANA, BTP).
 *
 * Each method returns { accept, contentType } for a specific operation.
 * Accept can contain multiple values (comma-separated), Content-Type is always single.
 */
export interface IAdtHeaders {
    accept: string;
    contentType: string;
}
export interface IAdtContentTypes {
    programCreate(): IAdtHeaders;
    programRead(): IAdtHeaders;
    classCreate(): IAdtHeaders;
    classRead(): IAdtHeaders;
    interfaceCreate(): IAdtHeaders;
    domainCreate(): IAdtHeaders;
    domainRead(): IAdtHeaders;
    domainUpdate(): IAdtHeaders;
    dataElementCreate(): IAdtHeaders;
    dataElementRead(): IAdtHeaders;
    dataElementUpdate(): IAdtHeaders;
    structureCreate(): IAdtHeaders;
    tableCreate(): IAdtHeaders;
    packageCreate(): IAdtHeaders;
    packageRead(): IAdtHeaders;
    packageUpdate(): IAdtHeaders;
    functionGroupCreate(): IAdtHeaders;
    functionGroupUpdate(): IAdtHeaders;
    sourceArtifactContentType(): string;
}
/**
 * Base content types — v1 headers, works on all SAP systems including older BASIS
 */
export declare class AdtContentTypesBase implements IAdtContentTypes {
    protected readonly unicode: boolean;
    constructor(unicode?: boolean);
    programCreate(): IAdtHeaders;
    programRead(): IAdtHeaders;
    classCreate(): IAdtHeaders;
    classRead(): IAdtHeaders;
    interfaceCreate(): IAdtHeaders;
    domainCreate(): IAdtHeaders;
    domainRead(): IAdtHeaders;
    domainUpdate(): IAdtHeaders;
    dataElementCreate(): IAdtHeaders;
    dataElementRead(): IAdtHeaders;
    dataElementUpdate(): IAdtHeaders;
    structureCreate(): IAdtHeaders;
    tableCreate(): IAdtHeaders;
    packageCreate(): IAdtHeaders;
    packageRead(): IAdtHeaders;
    packageUpdate(): IAdtHeaders;
    functionGroupCreate(): IAdtHeaders;
    functionGroupUpdate(): IAdtHeaders;
    sourceArtifactContentType(): string;
}
/**
 * Modern content types — v2+ headers for S/4 HANA, BTP, and newer BASIS systems.
 * Accept includes both new and old versions for compatibility.
 * Content-Type uses the newest version.
 */
export declare class AdtContentTypesModern extends AdtContentTypesBase {
    constructor();
    classCreate(): IAdtHeaders;
    classRead(): IAdtHeaders;
    interfaceCreate(): IAdtHeaders;
    programCreate(): IAdtHeaders;
    programRead(): IAdtHeaders;
    domainCreate(): IAdtHeaders;
    domainRead(): IAdtHeaders;
    domainUpdate(): IAdtHeaders;
    dataElementCreate(): IAdtHeaders;
    dataElementRead(): IAdtHeaders;
    dataElementUpdate(): IAdtHeaders;
    structureCreate(): IAdtHeaders;
    tableCreate(): IAdtHeaders;
    packageCreate(): IAdtHeaders;
    packageRead(): IAdtHeaders;
    packageUpdate(): IAdtHeaders;
    functionGroupCreate(): IAdtHeaders;
    functionGroupUpdate(): IAdtHeaders;
}
//# sourceMappingURL=contentTypes.d.ts.map