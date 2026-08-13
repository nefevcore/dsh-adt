/**
 * Internal utilities for ADT clients
 * These are private utilities used internally by client classes
 */
import type { IAdtResponse } from '@mcp-abap-adt/interfaces';
type AdtHeaderValue = IAdtResponse['headers'][string];
/**
 * Encodes SAP object names for use in URLs
 * Handles namespaces with forward slashes that need to be URL encoded
 * @param objectName - The SAP object name (e.g., '/1CPR/CL_000_0SAP2_FAG')
 * @returns URL-encoded object name
 */
export declare function encodeSapObjectName(objectName: string): string;
/**
 * Builds a URL query string with proper encoding of special characters.
 * Axios default serializer does not encode $ (and other sub-delimiters),
 * which causes ERR_UNESCAPED_CHARACTERS in Node.js for names like $TMP.
 * URLSearchParams encodes all non-alphanumeric characters correctly.
 * @param params - Key-value pairs for query parameters (undefined values are omitted)
 * @returns Encoded query string without leading '?'
 */
export declare function buildQueryString(params: Record<string, string | boolean | number | undefined>): string;
/**
 * Limits description to 60 characters as per SAP ADT specification
 * SAP ADT has a maximum length of 60 characters for adtcore:description field
 * @param description - Description text
 * @returns Description limited to 60 characters
 */
export declare function limitDescription(description: string): string;
export declare function headerValueToString(value: AdtHeaderValue | undefined): string | undefined;
/**
 * Safely extracts error message from any error object.
 * Prevents circular reference issues when logging AxiosError or other HTTP errors.
 * @param error - Any error object (AxiosError, Error, string, unknown)
 * @returns Safe string representation of the error
 */
export declare function safeErrorMessage(error: unknown): string;
/**
 * Safely stringify any value, handling circular references.
 * Use instead of JSON.stringify() on values that may contain circular references
 * (e.g., Axios response data, HTTP error objects).
 * @param value - Any value to stringify
 * @param maxLength - Maximum length of the result (default 500)
 * @returns JSON string or fallback string representation
 */
export declare function safeStringify(value: unknown, maxLength?: number): string;
export {};
//# sourceMappingURL=internalUtils.d.ts.map