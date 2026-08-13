"use strict";
/**
 * ADT Clients Package - Main exports
 *
 * Client APIs (Public API):
 * - AdtClient: High-level CRUD operations (validate/create/read/update/delete/activate/check)
 * - AdtRuntimeClient: Runtime operations (stable APIs)
 * - AdtRuntimeClientExperimental: Runtime APIs in progress (may change)
 *
 * @example
 * ```typescript
 * import { AdtClient } from '@mcp-abap-adt/adt-clients';
 *
 * const client = new AdtClient(connection);
 * await client.getProgram().create({
 *   programName: 'ZTEST',
 *   packageName: 'ZPACKAGE',
 *   description: 'Test program',
 * });
 * await client.getProgram().read({ programName: 'ZTEST' });
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./index.abapgit"), exports);
__exportStar(require("./index.batch"), exports);
__exportStar(require("./index.core"), exports);
__exportStar(require("./index.executors"), exports);
__exportStar(require("./index.runtime"), exports);
__exportStar(require("./index.ws"), exports);
