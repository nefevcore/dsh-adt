/**
 * FeedRepository - Domain object for feed operations
 *
 * Provides access to feed reader, runtime dumps, system messages,
 * and gateway error feeds with Atom XML parsing.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import type { IFeedDescriptor, IFeedEntry, IFeedQueryOptions, IFeedRepository, IFeedVariant, IGatewayErrorDetail, IGatewayErrorEntry, ISystemMessageEntry } from './types';
export declare class FeedRepository implements IFeedRepository, IRuntimeAnalysisObject {
    private readonly connection;
    private readonly logger;
    readonly kind: "feedRepository";
    constructor(connection: IAbapConnection, logger: ILogger);
    list(): Promise<IFeedDescriptor[]>;
    variants(): Promise<IFeedVariant[]>;
    dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
    systemMessages(options?: IFeedQueryOptions): Promise<ISystemMessageEntry[]>;
    gatewayErrors(options?: IFeedQueryOptions): Promise<IGatewayErrorEntry[]>;
    gatewayErrorDetail(feedUrl: string): Promise<IGatewayErrorDetail>;
    /**
     * Fetch and parse any feed URL as generic IFeedEntry array.
     * Internal helper — not part of IFeedRepository.
     */
    byUrl(feedUrl: string, options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
}
//# sourceMappingURL=FeedRepository.d.ts.map