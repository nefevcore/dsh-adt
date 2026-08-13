/**
 * AdtUtilsLegacy - Utility operations for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides methods that rely on endpoints absent from legacy /sap/bc/adt/discovery:
 * - getTableContents → /sap/bc/adt/datapreview/ddic (not available)
 * - getSqlQuery → /sap/bc/adt/datapreview/freestyle (not available)
 * - getTransaction → /sap/bc/adt/repository/informationsystem/objectproperties (not available)
 * - activateObjectsGroup → /sap/bc/adt/activation/runs (not available, uses /sap/bc/adt/activation)
 */
import type { IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from './AdtUtils';
import type { IObjectReference } from './types';
export declare class AdtUtilsLegacy extends AdtUtils {
    /**
     * Legacy group activation — synchronous POST to /sap/bc/adt/activation
     *
     * Modern systems use async /sap/bc/adt/activation/runs with polling.
     * Legacy systems use synchronous /sap/bc/adt/activation — response contains result directly.
     */
    activateObjectsGroup(objects: IObjectReference[], preauditRequested?: boolean): Promise<IAdtResponse>;
    getTableContents(): Promise<never>;
    getSqlQuery(): Promise<never>;
    getTransaction(): Promise<never>;
}
//# sourceMappingURL=AdtUtilsLegacy.d.ts.map