// wait-preview.mjs — block until `vite preview` answers, or give up.
//
// The Playwright gates all assume a server is already up on :4173 and none of
// them spawn one (by design — see any verify-*.mjs "Run:" header). CI therefore
// needs to background `npm run preview` and wait. `sleep 2` is what the headers
// suggest for local use, but it is a race on a cold CI runner.
//
// Dependency-free on purpose: this repo has no wait-on/wait-port and adding a
// dep for six lines of polling would be the wrong trade.
//
// Usage: node scripts/wait-preview.mjs [url] [timeoutMs]

const url = process.argv[2] ?? 'http://localhost:4173/';
const timeoutMs = Number(process.argv[3] ?? 60_000);
const deadline = Date.now() + timeoutMs;

while (Date.now() < deadline) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      console.log(`preview ready at ${url}`);
      process.exit(0);
    }
  } catch {
    // not up yet
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.error(`preview did not come up at ${url} within ${timeoutMs}ms`);
process.exit(1);
