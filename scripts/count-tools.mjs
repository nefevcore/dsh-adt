import { AdtRegistry, LockLedger, DebuggerManager, assembleAdtTools, builtinDefaults } from '../packages/adt-core/lib/index.js';
const reg = await AdtRegistry.create({ ...builtinDefaults(), demo: true, demoPort: 0 });
const tools = assembleAdtTools({ registry: reg, ledger: new LockLedger(), debugger: new DebuggerManager(reg) }, { get: () => undefined });
console.log('registered:', tools.length);
console.log(tools.map((t) => t.name).sort().join(' '));
await reg.dispose();
