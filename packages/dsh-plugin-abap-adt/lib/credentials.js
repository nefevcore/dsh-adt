/** A POSIX environment-variable name (CredentialRef grammar). */
export const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Whether a raw string could name a credential reference at all. */
export function isCredentialRefName(value) {
    return CREDENTIAL_REF_PATTERN.test(value);
}
/**
 * The credential service of a context, when mounted. Resolved per call so a
 * service appearing or disappearing between operations is respected.
 */
export function credentialsOf(ctx) {
    const service = ctx.get?.('credentials');
    return service !== undefined && service !== null ? service : undefined;
}
/**
 * Build a per-call credential resolver for the registry: resolves a reference
 * name through the credential service when mounted (falling back to raw
 * process.env in config.ts when it is not).
 */
export function credentialResolverOf(ctx) {
    return async (ref) => {
        const service = credentialsOf(ctx);
        if (!service)
            return undefined;
        try {
            return (await service.resolve(ref))?.value;
        }
        catch {
            return undefined; // an unavailable store must not break destination use
        }
    };
}
//# sourceMappingURL=credentials.js.map