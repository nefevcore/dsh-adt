/**
 * AdtClassLegacy - Class handler for legacy SAP systems (BASIS < 7.50)
 *
 * On legacy systems, the x-sap-adt-sessiontype: stateful header causes locks
 * to be stored in ABAP session memory instead of the global enqueue server.
 * This means lock + update + unlock MUST happen within the same stateful
 * HTTP session — switching to stateless between lock and update invalidates
 * the lock handle (GitHub #11).
 *
 * Overrides:
 * - update() — keeps lock→check→update→unlock in one stateful session
 * - delete() — uses direct DELETE instead of /sap/bc/adt/deletion/ API
 */
import type { IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AdtClass } from './AdtClass';
import type { IClassConfig, IClassState } from './types';
export declare class AdtClassLegacy extends AdtClass {
    /**
     * Update class — legacy override.
     *
     * Keeps lock→check→update→unlock in a single stateful session so the
     * lock handle remains valid (legacy stores locks in ABAP session memory).
     */
    update(config: Partial<IClassConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    delete(config: Partial<IClassConfig>): Promise<IClassState>;
}
//# sourceMappingURL=AdtClassLegacy.d.ts.map