import z from '@deepseek-ai/schemastery';
/**
 * Plugin configuration schema (schemastery), validated by the Cordis loader.
 * The shipped bundle patch provides safe defaults; users override
 * `destinations` and the permission policy in their profile's
 * `cordis.patch.yml`.
 */
export const Config = z.object({
    /** Optional in-process demo destination backed by the mock ADT server. */
    demo: z.boolean().default(true),
    demoPort: z.number().default(8123),
    /** Default destination name used by tools when none is given. */
    defaultDestination: z.string().default('demo'),
    /**
     * Permission policy ("权限管控") knobs. Each is optional: when omitted the
     * corresponding `SAP_*` environment variable is consulted, then a built-in
     * default. See `src/policy.ts` for the full semantics.
     */
    /** Allow the transport tool family and transport usage (env: SAP_ENABLE_TRANSPORTS). */
    enableTransports: z.boolean(),
    /** Comma-separated glob list of allowed transport request numbers, e.g. `D01K96*` (env: SAP_ALLOWED_TRANSPORTS). */
    allowedTransports: z.string(),
    /** Allow edits (write/create/delete/activate) on transportable (non-$TMP) packages (env: SAP_ALLOW_TRANSPORTABLE_EDITS). */
    allowTransportableEdits: z.boolean(),
    /** Comma-separated glob list of packages that may be edited, e.g. `Z*,$TMP` (env: SAP_ALLOWED_PACKAGES). */
    allowedPackages: z.string(),
    destinations: z
        .array(z.object({
        name: z.string().required(),
        /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
        url: z.string().required(),
        /** SAP client (mandant). */
        client: z.string(),
        /** Logon language, e.g. `EN`, `ZH`. */
        language: z.string(),
        username: z.string(),
        /** Static password (prefer `passwordEnv` / env var conventions). */
        password: z.string(),
        /** Name of the environment variable holding the password. */
        passwordEnv: z.string(),
        strictSSL: z.boolean().default(true),
        timeoutMs: z.number().default(60_000),
    }))
        .default([]),
});
/** Resolve the password for a destination: config > passwordEnv > convention. */
export function resolvePassword(dest) {
    if (dest.password)
        return dest.password;
    const envName = dest.passwordEnv ?? `ADT_${dest.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_PASSWORD`;
    const direct = process.env[envName];
    if (direct)
        return direct;
    return process.env.ADT_PASSWORD ?? '';
}
//# sourceMappingURL=config.js.map