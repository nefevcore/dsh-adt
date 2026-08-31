/**
 * Structural seam over the DSH credential service (`ctx.credentials`, backed
 * by `~/.dsh/.credentials.yaml` — the dsh-credentials package). Optional
 * service: resolved per call via `ctx.get('credentials')`, so lean profiles
 * without it simply skip the credential layers.
 *
 * The service resolves a CredentialRef — a POSIX environment-variable name
 * such as `ADT_DEV_PASSWORD` — layer-wise over the process environment, the
 * provider-managed store (`.credentials.yaml`), and `.env` files. That is
 * exactly the plugin's `passwordEnv` convention: a destination's
 * `passwordEnv: ADT_DEV_PASSWORD` names an entry the user maintains either
 * as a real environment variable OR in the DSH credentials file.
 *
 * Structural typing (no runtime dependency on dsh-credentials): the host
 * service object satisfies this interface, and tests inject fakes.
 */
import type { Context } from '@deepseek-ai/cordis';

/** Minimal surface of the host credential service the plugin consumes. */
export interface CredentialsService {
  /** Resolve one reference (env-var name) to its current value, if set. */
  resolve(ref: string): Promise<{ value: string; source?: string } | undefined>;
  /** Presence/writability facts for one reference — never the value. */
  describe?(ref: string): Promise<{ configured: boolean; writable: boolean } | undefined>;
  /** Durably store one value in the provider-managed writable source. */
  set?(ref: string, value: string): Promise<void>;
}

/** A POSIX environment-variable name (CredentialRef grammar). */
export const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Whether a raw string could name a credential reference at all. */
export function isCredentialRefName(value: string): boolean {
  return CREDENTIAL_REF_PATTERN.test(value);
}

/**
 * The credential service of a context, when mounted. Resolved per call so a
 * service appearing or disappearing between operations is respected.
 */
export function credentialsOf(ctx: Context): CredentialsService | undefined {
  const service = (ctx as unknown as { get?: (name: string) => unknown }).get?.('credentials');
  return service !== undefined && service !== null ? (service as CredentialsService) : undefined;
}

/**
 * Build a per-call credential resolver for the registry: resolves a reference
 * name through the credential service when mounted (falling back to raw
 * process.env in config.ts when it is not).
 */
export function credentialResolverOf(ctx: Context): (ref: string) => Promise<string | undefined> {
  return async (ref) => {
    const service = credentialsOf(ctx);
    if (!service) return undefined;
    try {
      return (await service.resolve(ref))?.value;
    } catch {
      return undefined; // an unavailable store must not break destination use
    }
  };
}
