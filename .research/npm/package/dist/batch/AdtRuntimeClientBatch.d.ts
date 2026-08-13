import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtRuntimeClient } from '../clients/AdtRuntimeClient';
import { BatchRecordingConnection } from './BatchRecordingConnection';
export declare class AdtRuntimeClientBatch {
    private recorder;
    private innerRuntime;
    private realConnection;
    constructor(connection: IAbapConnection, logger?: ILogger);
    getInnerClient(): AdtRuntimeClient;
    batchExecute(): Promise<IAdtResponse[]>;
    reset(): void;
    getRecorder(): BatchRecordingConnection;
}
//# sourceMappingURL=AdtRuntimeClientBatch.d.ts.map