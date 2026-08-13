import type { IAbapConnection, IAdtOperationOptions, IAdtResponse, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { IActivateServiceBindingParams, IAdtServiceBinding, ICheckServiceBindingParams, IClassifyServiceBindingParams, ICreateAndGenerateServiceBindingParams, ICreateServiceBindingParams, IDeleteServiceBindingParams, IGenerateServiceBindingParams, IGetServiceBindingODataParams, IPublishODataV2Params, IReadServiceBindingParams, IServiceBindingConfig, IServiceBindingState, ITransportCheckServiceBindingParams, IUnpublishODataV2Params, IUpdateServiceBindingParams, IValidateServiceBindingParams } from './types';
export declare class AdtServiceBinding implements IAdtServiceBinding {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext);
    private parser;
    private asRecord;
    private static encodeName;
    private buildServiceBindingCreateXml;
    private buildTransportCheckXml;
    private buildDeletionXml;
    private extractAvailableBindingTypes;
    private parseServiceBindingState;
    private getBindingTypeAvailabilityKey;
    private publishByServiceType;
    private unpublishByServiceType;
    validate(config: Partial<IServiceBindingConfig>): Promise<IServiceBindingState>;
    create(config: IServiceBindingConfig, options?: IAdtOperationOptions): Promise<IServiceBindingState>;
    read(config: Partial<IServiceBindingConfig>, version?: 'active' | 'inactive'): Promise<IServiceBindingState | undefined>;
    readMetadata(config: Partial<IServiceBindingConfig>, options?: {
        withLongPolling?: boolean;
        version?: 'active' | 'inactive';
    }): Promise<IServiceBindingState>;
    update(config: Partial<IServiceBindingConfig>): Promise<IServiceBindingState>;
    delete(config: Partial<IServiceBindingConfig>): Promise<IServiceBindingState>;
    activate(config: Partial<IServiceBindingConfig>): Promise<IServiceBindingState>;
    check(config: Partial<IServiceBindingConfig>, status?: string): Promise<IServiceBindingState>;
    readTransport(config: Partial<IServiceBindingConfig>): Promise<IServiceBindingState>;
    lock(_config: Partial<IServiceBindingConfig>): Promise<string>;
    unlock(_config: Partial<IServiceBindingConfig>, _lockHandle: string): Promise<IServiceBindingState>;
    getServiceBindingTypes(): Promise<IAdtResponse>;
    validateServiceBinding(params: IValidateServiceBindingParams): Promise<IAdtResponse>;
    transportCheckServiceBinding(params: ITransportCheckServiceBindingParams): Promise<IAdtResponse>;
    createServiceBinding(params: ICreateServiceBindingParams): Promise<IAdtResponse>;
    readServiceBinding(params: IReadServiceBindingParams): Promise<IAdtResponse>;
    updateServiceBinding(params: IUpdateServiceBindingParams): Promise<IAdtResponse>;
    deleteServiceBinding(params: IDeleteServiceBindingParams): Promise<IAdtResponse>;
    checkServiceBinding(params: ICheckServiceBindingParams): Promise<IAdtResponse>;
    activateServiceBinding(params: IActivateServiceBindingParams): Promise<IAdtResponse>;
    generateServiceBinding(params: IGenerateServiceBindingParams): Promise<IAdtResponse>;
    createAndGenerateServiceBinding(params: ICreateAndGenerateServiceBindingParams): Promise<{
        createResult: IAdtResponse;
        inactiveCheckResult: IAdtResponse;
        activationResult?: IAdtResponse;
        readResult: IAdtResponse;
        generatedInfoResult: IAdtResponse;
        activeCheckResult?: IAdtResponse;
    }>;
    getODataV2ServiceBinding(params: IGetServiceBindingODataParams): Promise<IAdtResponse>;
    getODataV4ServiceBinding(params: IGetServiceBindingODataParams): Promise<IAdtResponse>;
    publishODataV2(params: IPublishODataV2Params): Promise<IAdtResponse>;
    unpublishODataV2(params: IUnpublishODataV2Params): Promise<IAdtResponse>;
    classifyServiceBinding(params: IClassifyServiceBindingParams): Promise<IAdtResponse>;
    getVersions(_config: Partial<IServiceBindingConfig>): Promise<IObjectVersion[]>;
    getVersionSource(_contentUri: string): Promise<string>;
}
export declare class AdtService extends AdtServiceBinding {
}
//# sourceMappingURL=AdtService.d.ts.map