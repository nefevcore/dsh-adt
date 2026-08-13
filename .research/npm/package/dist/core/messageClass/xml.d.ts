export interface IParsedMessage {
    msgno: string;
    msgtext: string;
    selfExplanatory?: boolean;
    description?: string;
    rawAttrs?: Record<string, string>;
}
export interface IParsedMessageClass {
    name: string;
    description?: string;
    language?: string;
    masterLanguage?: string;
    masterSystem?: string;
    responsible?: string;
    packageName?: string;
    messages: IParsedMessage[];
    rawAttrs?: Record<string, string>;
}
export declare function parseMessageClass(xml: string): IParsedMessageClass;
export declare function buildMessageClassXml(cls: IParsedMessageClass, opts?: {
    messageLockHandles?: Record<string, string>;
    deletedMsgnos?: string[];
}): string;
//# sourceMappingURL=xml.d.ts.map