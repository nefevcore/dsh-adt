/**
 * Program operations - exports
 */
import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { IProgramConfig, IProgramState } from './types';
export { AdtProgram } from './AdtProgram';
export { runProgram } from './run';
export * from './types';
export type AdtProgramType = IAdtSourceObject<IProgramConfig, IProgramState>;
//# sourceMappingURL=index.d.ts.map