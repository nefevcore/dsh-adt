/**
 * Timeout utilities for ADT clients
 *
 * Provides timeout configuration similar to connection package
 * but without dependency on connection package
 */
import type { ITimeoutConfig } from '@mcp-abap-adt/interfaces';
/**
 * Get timeout configuration from environment variables
 */
export declare function getTimeoutConfig(): ITimeoutConfig;
/**
 * Get timeout value by type or number
 * @param type - Timeout type ("default", "csrf", "long") or number
 * @returns Timeout value in milliseconds
 */
export declare function getTimeout(type?: 'default' | 'csrf' | 'long' | number): number;
//# sourceMappingURL=timeouts.d.ts.map