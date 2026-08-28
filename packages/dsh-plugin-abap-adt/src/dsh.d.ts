/**
 * Module augmentation: type the dsh filesystem service on Context so tools
 * can read it through the sandbox-aware `ctx.get('fs')` seam (optional
 * service — audit D1: the plugin no longer hard-injects `fs`, so `ctx.fs`
 * property reads must not be used; resolve per call and handle `undefined`).
 */
import type { FileSystem } from '@deepseek-ai/dsh-fs';

declare module '@deepseek-ai/cordis' {
  interface Context {
    fs: FileSystem;
  }
}
