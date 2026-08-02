// verify-reporter.mjs — the shared gate reporter, and nothing else.
//
// WHY THIS IS A SEPARATE MODULE FROM verify-lib.mjs
//
// verify-lib.mjs's first import is `playwright`. That resolves fine in CI's
// `build` job (playwright is a devDependency and `npm ci` runs there), so this
// split is NOT about a missing package — the browser BINARIES are what `build`
// skips, and those are only touched at chromium.launch().
//
// It is about two things that matter more:
//
//   1. The `build` job is named "typecheck + build + offline gates" and its own
//      comment says "Offline gates only — no browser, no network." A gate whose
//      module graph opens with a browser-automation library contradicts that
//      contract even while it happens to work. Contracts that hold only by luck
//      are the ones that break silently later.
//
//   2. api/verify-status.mjs needs `fixture()`, and a COPY of this reporter
//      would give the four-counter invariant a second home. `fixture()` exists
//      precisely so "12 passed · 3 fixtured · 1 skipped" can never be read as
//      "16 passed"; two implementations of that rule, each locally consistent,
//      drift apart with nothing to notice. That is the same shape as every
//      failure this batch has catalogued.
//
// So: api/verify-status.mjs reaches ACROSS into app/ for this file. That is a
// new direction (api/ → app/) and it is deliberate. ci.yml already runs the api
// gates as `node ../api/verify-*.mjs` under `defaults.run.working-directory:
// app`, so the two trees are already coupled at the runner level. Do not "tidy"
// the api gate into its own private reporter — that is reason 2, reintroduced.
//
// This module must import NOTHING but `node:` builtins. verify-resilience.mjs
// asserts that statically, so the coupling cannot quietly grow back the first
// time someone wants one convenience helper from verify-lib.

/**
 * The shared reporter.
 *
 * `skip` and `fixture` exist because a gate must never report a pass on
 * something it did not check, and this repo has been bitten by that repeatedly:
 * verify-v510 stayed permanently red until people learned to ignore red,
 * verify-future sat orphaned so twelve assertions never ran at all, and
 * verify-shots counted screenshots it never compared toward a
 * "pixel-identical" claim. The fix is not to check more — sometimes you
 * genuinely cannot — it is to make the unchecked items their own NUMBER
 * instead of letting them vanish into a success count.
 *
 *   ok(cond, label)        a real assertion against real behaviour
 *   skip(label, why)       could not be checked here (API absent, engine
 *                          lacking, upstream unreachable). NOT a pass.
 *   fixture(label, what)   checked against a fixture rather than the real
 *                          upstream. Real coverage, but of the fixture — say so.
 *
 * `finish()` prints all four counts, so "12 passed · 3 fixtured · 1 skipped"
 * can never be read as "16 passed".
 */
export function makeReporter(name) {
  let failed = false;
  let passed = 0;
  let failures = 0;
  let skipped = 0;
  let fixtured = 0;
  return {
    ok(cond, label, detail = '') {
      if (cond) { passed++; console.log(`  ✅ ${label}`); }
      else { failed = true; failures++; console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); }
      return cond;
    },
    /** Could not be checked in this environment. Never counts as a pass. */
    skip(label, why) {
      skipped++;
      console.log(`  ⏭  ${label} — SKIPPED: ${why}`);
    },
    /** Checked, but against a fixture rather than the real upstream. */
    fixture(label, what) {
      fixtured++;
      console.log(`  🧪 ${label} — fixtured: ${what}`);
    },
    info(msg) { console.log(`  ·  ${msg}`); },
    group(title) { console.log(`\n${title}`); },
    finish() {
      const tally =
        `${passed} passed · ${fixtured} fixtured · ${skipped} skipped · ${failures} failed`;
      console.log('\n' + (failed ? `❌ ${name}: FAILURES — ${tally}` : `✅ ${name}: ${tally}`));
      return failed ? 1 : 0;
    },
  };
}
