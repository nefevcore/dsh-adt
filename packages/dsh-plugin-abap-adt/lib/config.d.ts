import z from '@deepseek-ai/schemastery';
/** Portable instance type of a schemastery schema. */
type SchemaInstance = InstanceType<typeof z>;
/**
 * Plugin configuration schema (schemastery), validated by the Cordis loader.
 * The shipped bundle patch provides safe defaults; users override
 * `destinations` in their profile's `cordis.patch.yml`.
 */
export declare const Config: SchemaInstance;
export type PluginConfig = Schemastery.TypeT<typeof Config>;
/** Resolve the password for a destination: config > passwordEnv > convention. */
export declare function resolvePassword(dest: {
    password?: string;
    passwordEnv?: string;
    name: string;
}): string;
export {};
//# sourceMappingURL=config.d.ts.map