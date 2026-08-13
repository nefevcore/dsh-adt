"use strict";
/**
 * Error classes for unsupported ADT operations
 *
 * These errors are thrown when an operation is not implemented
 * in ADT for a specific object type.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsupportedValidateOperationError = exports.UnsupportedCheckOperationError = exports.UnsupportedActivateOperationError = exports.UnsupportedDeleteOperationError = exports.UnsupportedUpdateOperationError = exports.UnsupportedCreateOperationError = exports.UnsupportedAdtOperationError = void 0;
/**
 * Base error for unsupported ADT operations
 */
class UnsupportedAdtOperationError extends Error {
    operation;
    objectType;
    constructor(operation, objectType, message) {
        super(message ||
            `${operation} operation is not implemented in ADT for ${objectType} objects`);
        this.operation = operation;
        this.objectType = objectType;
        this.name = 'UnsupportedAdtOperationError';
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, UnsupportedAdtOperationError);
        }
    }
}
exports.UnsupportedAdtOperationError = UnsupportedAdtOperationError;
/**
 * Error thrown when create operation is not supported
 */
class UnsupportedCreateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType) {
        super('Create', objectType);
        this.name = 'UnsupportedCreateOperationError';
    }
}
exports.UnsupportedCreateOperationError = UnsupportedCreateOperationError;
/**
 * Error thrown when update operation is not supported
 */
class UnsupportedUpdateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType) {
        super('Update', objectType);
        this.name = 'UnsupportedUpdateOperationError';
    }
}
exports.UnsupportedUpdateOperationError = UnsupportedUpdateOperationError;
/**
 * Error thrown when delete operation is not supported
 */
class UnsupportedDeleteOperationError extends UnsupportedAdtOperationError {
    constructor(objectType) {
        super('Delete', objectType);
        this.name = 'UnsupportedDeleteOperationError';
    }
}
exports.UnsupportedDeleteOperationError = UnsupportedDeleteOperationError;
/**
 * Error thrown when activate operation is not supported
 */
class UnsupportedActivateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType) {
        super('Activate', objectType);
        this.name = 'UnsupportedActivateOperationError';
    }
}
exports.UnsupportedActivateOperationError = UnsupportedActivateOperationError;
/**
 * Error thrown when check operation is not supported
 */
class UnsupportedCheckOperationError extends UnsupportedAdtOperationError {
    constructor(objectType) {
        super('Check', objectType);
        this.name = 'UnsupportedCheckOperationError';
    }
}
exports.UnsupportedCheckOperationError = UnsupportedCheckOperationError;
/**
 * Error thrown when validate operation is not supported
 */
class UnsupportedValidateOperationError extends UnsupportedAdtOperationError {
    constructor(objectType) {
        super('Validate', objectType);
        this.name = 'UnsupportedValidateOperationError';
    }
}
exports.UnsupportedValidateOperationError = UnsupportedValidateOperationError;
