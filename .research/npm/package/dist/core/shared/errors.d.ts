/**
 * Error classes for unsupported ADT operations
 *
 * These errors are thrown when an operation is not implemented
 * in ADT for a specific object type.
 */
/**
 * Base error for unsupported ADT operations
 */
export declare class UnsupportedAdtOperationError extends Error {
    readonly operation: string;
    readonly objectType: string;
    constructor(operation: string, objectType: string, message?: string);
}
/**
 * Error thrown when create operation is not supported
 */
export declare class UnsupportedCreateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType: string);
}
/**
 * Error thrown when update operation is not supported
 */
export declare class UnsupportedUpdateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType: string);
}
/**
 * Error thrown when delete operation is not supported
 */
export declare class UnsupportedDeleteOperationError extends UnsupportedAdtOperationError {
    constructor(objectType: string);
}
/**
 * Error thrown when activate operation is not supported
 */
export declare class UnsupportedActivateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType: string);
}
/**
 * Error thrown when check operation is not supported
 */
export declare class UnsupportedCheckOperationError extends UnsupportedAdtOperationError {
    constructor(objectType: string);
}
/**
 * Error thrown when validate operation is not supported
 */
export declare class UnsupportedValidateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType: string);
}
//# sourceMappingURL=errors.d.ts.map