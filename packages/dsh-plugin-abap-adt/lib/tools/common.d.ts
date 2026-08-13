import type { AdtObjectRef } from '@abap-adt/protocol';
import type { AdtRegistry } from '../registry.js';
/** Parameter spec for the destination selector used by every tool. */
export declare const DESTINATION_PARAM: {
    readonly destination: {
        readonly type: "string";
        readonly description: "Destination name (configured in the plugin config). Omit to use the default destination.";
    };
};
/** Pull the destination param value out of raw args. */
export declare function destinationOf(args: Record<string, unknown>): string | undefined;
/** Register-time helper: name a tool and give it the registry. */
export interface ToolDeps {
    registry: AdtRegistry;
}
/** Render a simple text block. */
export declare function text(content: string): Array<{
    type: 'text';
    text: string;
}>;
/** Render an object list as a compact table. */
export declare function renderObjectRefs(refs: AdtObjectRef[]): string;
/** A terse success renderer shared by lifecycle tools. */
export declare function renderMessages(title: string, lines: string[]): string;
//# sourceMappingURL=common.d.ts.map