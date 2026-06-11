let passed = 0, failed = 0;
const pending = [];

export function test(name, fn) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      const p = r.then(() => { passed++; log("✓", name); })
                 .catch((e) => { failed++; log("✗", name, e.message); });
      pending.push(p);
      return p;
    }
    passed++; log("✓", name);
  } catch (e) { failed++; log("✗", name, e.message); }
}

export function eq(a, b, msg = "") {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg} expected ${B} got ${A}`);
}
export function ok(v, msg = "assertion failed") { if (!v) throw new Error(msg); }

/** Await all async tests, then print the summary. */
export async function report() {
  await Promise.all(pending);
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}
function log(sym, name, extra = "") { console.log(`  ${sym} ${name}${extra ? " — " + extra : ""}`); }
