import { type GeneratedServiceType, type ServiceBindingType, type ServiceBindingVariant, type ServiceBindingVersion } from '@mcp-abap-adt/interfaces';
export type { AdtServiceBindingType, DesiredPublicationState, GeneratedServiceType, IActivateServiceBindingParams, IAdtService, IAdtServiceBinding, IAdtServiceOperationOptions, ICheckServiceBindingParams, IClassifyServiceBindingParams, ICreateAndGenerateServiceBindingParams, ICreateAndGenerateServiceBindingParamsLegacy, ICreateServiceBindingParams, IDeleteServiceBindingParams, IGenerateServiceBindingParams, IGetServiceBindingODataParams, IPublishODataV2Params, IReadServiceBindingParams, IServiceBindingConfig, IServiceBindingState, ITransportCheckServiceBindingParams, IUnpublishODataV2Params, IUpdateServiceBindingParams, IValidateServiceBindingParams, ServiceBindingType, ServiceBindingVariant, ServiceBindingVersion, } from '@mcp-abap-adt/interfaces';
export { SERVICE_BINDING_VARIANT_MAP } from '@mcp-abap-adt/interfaces';
export declare function resolveBindingVariant(variant: ServiceBindingVariant): {
    bindingType: ServiceBindingType;
    bindingVersion: ServiceBindingVersion;
    bindingCategory: '0' | '1';
    serviceType: GeneratedServiceType;
};
//# sourceMappingURL=types.d.ts.map