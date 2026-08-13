/**
 * Module augmentation: expose the dsh filesystem service on Context so tools
 * can write exports through the sandbox-aware `ctx.fs` seam.
 */
import type { FileSystem } from '@deepseek-ai/dsh-fs';

declare module '@deepseek-ai/cordis' {
  interface Context {
    fs: FileSystem;
  }
}
