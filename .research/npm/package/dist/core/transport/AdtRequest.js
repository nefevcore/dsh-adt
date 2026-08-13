"use strict";
/**
 * AdtRequest - High-level CRUD operations for Transport Request objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - No stateful needed for transport operations
 * - Transport requests don't use lock/unlock
 *
 * Operation chains:
 * - Create: create (no validation, no check, no activate)
 * - Read: read (get transport request details)
 * - Update: not supported (transport requests are immutable after creation)
 * - Delete: not supported (transport requests cannot be deleted via ADT)
 * - Activate: not supported (transport requests are not activated)
 * - Check: not supported (transport requests don't have check operation)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtRequest = void 0;
const internalUtils_1 = require("../../utils/internalUtils");
const versions_1 = require("../shared/versions");
const create_1 = require("./create");
const list_1 = require("./list");
const read_1 = require("./read");
class AdtRequest {
    connection;
    logger;
    systemContext;
    objectType = 'Request';
    constructor(connection, logger, systemContext) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
    }
    /**
     * Validate transport request configuration before creation
     * Note: ADT doesn't provide validation endpoint for transport requests
     */
    async validate(config) {
        if (!config.description) {
            throw new Error('Transport request description is required for validation');
        }
        // ADT doesn't provide validation endpoint for transport requests
        // Return empty state
        return {
            errors: [],
        };
    }
    /**
     * Create transport request
     */
    async create(config, _options) {
        if (!config.description) {
            throw new Error('Transport request description is required');
        }
        try {
            this.logger?.info?.('Creating transport request');
            const response = await (0, create_1.createTransport)(this.connection, {
                transport_type: config.transportType === 'customizing' ? 'customizing' : 'workbench',
                description: config.description,
                target_system: config.targetSystem,
                owner: config.owner ?? this.systemContext.responsible,
            });
            const transportNumber = response.data?.transport_request;
            if (!transportNumber) {
                throw new Error('Failed to create transport request: transport number not returned');
            }
            this.logger?.info?.('Transport request created:', transportNumber);
            return {
                createResult: response,
                transportNumber,
                errors: [],
            };
        }
        catch (error) {
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read transport request
     */
    async read(config, _version) {
        if (!config.transportNumber) {
            throw new Error('Transport request number is required');
        }
        try {
            const response = await (0, read_1.getTransport)(this.connection, config.transportNumber);
            // Parse response data to extract transport request details
            // Response format depends on ADT API
            const _data = response.data;
            return {
                transportNumber: config.transportNumber,
                readResult: response,
                errors: [],
            };
        }
        catch (error) {
            const e = error;
            if (e.response?.status === 404) {
                return undefined;
            }
            throw error;
        }
    }
    /**
     * List transport requests
     */
    async list(params) {
        this.logger?.info?.('Listing transport requests for user:', params.user);
        const response = await (0, list_1.listTransports)(this.connection, {
            user: params.user,
            status: params.status,
            date_range: params.dateRange,
            target_system: params.targetSystem,
            request_type: params.requestType,
        });
        return { listResult: response, errors: [] };
    }
    /**
     * Read transport request metadata
     * For transport requests, read() already returns all metadata (description, owner, etc.)
     */
    async readMetadata(config) {
        // For transport requests, metadata is the same as read() result
        const readResult = await this.read(config);
        if (!readResult) {
            throw new Error('Transport request not found');
        }
        return readResult;
    }
    /**
     * Update transport request
     * Note: Transport requests are immutable after creation in ADT
     */
    async update(_config, _options) {
        throw new Error('Update operation is not supported for Transport Request objects in ADT');
    }
    /**
     * Delete transport request
     * Note: Transport requests cannot be deleted via ADT
     */
    async delete(_config) {
        throw new Error('Delete operation is not supported for Transport Request objects in ADT');
    }
    /**
     * Activate transport request
     * Note: Transport requests are not activated (they are containers for objects)
     */
    async activate(_config) {
        throw new Error('Activate operation is not supported for Transport Request objects in ADT');
    }
    /**
     * Check transport request
     * Note: Transport requests don't have check operation
     */
    async check(_config, _status) {
        throw new Error('Check operation is not supported for Transport Request objects in ADT');
    }
    /**
     * Read transport request information for the class
     */
    async readTransport(_config) {
        throw new Error('readTransport operation is not supported for Transport Request objects in ADT');
    }
    /**
     * Lock transport request (not supported)
     */
    async lock(_config) {
        throw new Error('Lock operation is not supported for transport requests');
    }
    /**
     * Unlock transport request (not supported)
     */
    async unlock(_config, _lockHandle) {
        throw new Error('Unlock operation is not supported for transport requests');
    }
    async getVersions(_config) {
        (0, versions_1.throwUnsupportedVersions)('transport request');
    }
    async getVersionSource(_contentUri) {
        (0, versions_1.throwUnsupportedVersions)('transport request');
    }
}
exports.AdtRequest = AdtRequest;
