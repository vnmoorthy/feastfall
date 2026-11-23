// Browser shim for node:fs — persistence is handled by local.js (localStorage) in static mode.
export default { readFileSync() { throw new Error('no fs in browser'); }, writeFileSync() {}, appendFileSync() {}, existsSync: () => false, mkdirSync() {} };
