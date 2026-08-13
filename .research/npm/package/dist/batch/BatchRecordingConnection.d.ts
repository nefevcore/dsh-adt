import type { IAbapConnection, IAbapRequestOptions, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IBatchRequestPart, IBatchResponsePart } from './types';
export declare class BatchRecordingConnection implements IAbapConnection {
    private realConnection;
    private parts;
    private deferred;
    constructor(realConnection: IAbapConnection);
    connect(): Promise<void>;
    getBaseUrl(): Promise<string>;
    getSessionId(): string | null;
    setSessionType(_type: 'stateful' | 'stateless'): void;
    makeAdtRequest<T = unknown, D = unknown>(options: IAbapRequestOptions): Promise<IAdtResponse<T, D>>;
    getRecordedParts(): IBatchRequestPart[];
    resolveAll(responses: IBatchResponsePart[]): void;
    reset(): void;
    getRealConnection(): IAbapConnection;
}
//# sourceMappingURL=BatchRecordingConnection.d.ts.map