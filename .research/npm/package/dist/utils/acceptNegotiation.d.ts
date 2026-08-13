import type { IAbapConnection, IAbapRequestOptions, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
export interface IAcceptNegotiationOptions {
    enableAcceptCorrection?: boolean;
    logger?: ILogger;
}
export declare function clearAcceptCache(): void;
export declare function setAcceptCorrectionEnabled(enabled?: boolean): void;
export declare function getAcceptCorrectionEnabled(): boolean;
export declare function extractSupportedAccept(error: unknown): string[];
export declare function extractSupportedContentType(error: unknown): string[];
export declare function wrapConnectionAcceptNegotiation(connection: IAbapConnection, logger?: ILogger): void;
export declare function makeAdtRequestWithAcceptNegotiation<T = unknown, D = unknown>(connection: IAbapConnection, request: IAbapRequestOptions, options?: IAcceptNegotiationOptions): Promise<IAdtResponse<T, D>>;
//# sourceMappingURL=acceptNegotiation.d.ts.map