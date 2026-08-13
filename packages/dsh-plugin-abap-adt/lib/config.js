import z from '@deepseek-ai/schemastery';
/**
 * Plugin configuration schema (schemastery), validated by the Cordis loader.
 * The shipped bundle patch provides safe defaults; users override
 * `destinations` in their profile's `cordis.patch.yml`.
 */
export const Config = z.object({
    /** Optional in-process demo destination backed by the mock ADT server. */
    demo: z.boolean().default(true),
    demoPort: z.number().default(8123),
    /** Default destination name used by tools when none is given. */
    defaultDestination: z.string().default('demo'),
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