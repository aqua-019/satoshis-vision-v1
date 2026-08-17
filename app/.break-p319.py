#!/usr/bin/env python3
"""p3·19 break-test harness — two polarities per §6 assertion.

Recorded traps this harness is built to avoid:
  · ALWAYS REBUILD, even for a gate-only mutation. p3·18's harness carried a
    `needs_build=False` flag and M9 measured M8's tree, reporting M8's red as
    its own. A result taken against a stale dist is VOID, not suspect.
  · The stale-dist trap bites from the OTHER door too (p3·16): restoring
    SOURCE leaves the MUTATED BUILD on disk, so the next run measures a tree
    that no longer exists. Rebuild between restore and re-measure.
  · Verify the restore against the COMMITTED BLOB, never the working tree
    (p3·12d): `git status` answers a narrower question than "is this file the
    one that was committed".
  · Assert the match count. p2·10 recorded a silent no-op `str.replace` whose
    script printed ok regardless — applied is not effective.
  · Bracket every proves-an-absence grep so EMPTY is distinguishable from
    CRASHED (p3·12d).
"""
import subprocess, sys, os, pathlib

APP = pathlib.Path(__file__).resolve().parent
PAGE = APP / "src/pages/SuperstressPage.tsx"

# (id, file, find, replace, what should go red)
MUTATIONS = [
    ("M1-resurrection", PAGE,
     "self-hosted by design rather than by delay. Nothing is being waited for here.",
     "self-hosted by design rather than by delay. A public telemetry endpoint is still pending.",
     "§6f resurrected — the historical claim, reintroduced"),

    ("M2-placeholder-restored", PAGE,
     '          <h2 className="serif" style={{ margin: 0, fontSize: "var(--fs-h2)", fontWeight: 400, color: "var(--ink-100)" }}>',
     '          <EmptySlot label="beta-chain mempool · to be wired" note="Awaiting a public telemetry endpoint for the beta chain — whether one exists is an open question with the maintainer." h={220} />\n'
     '          <h2 className="serif" style={{ margin: 0, fontSize: "var(--fs-h2)", fontWeight: 400, color: "var(--ink-100)" }}>',
     "§6b betaSlots !== 0 AND §6f resurrected — the whole pre-fix state"),

    ("M3-stray-port", PAGE,
     "self-hosted by design rather than by delay. Nothing is being waited for here.",
     "self-hosted by design rather than by delay. Nothing is being waited for here. Point a wallet at 18089.",
     "§6g strayPorts — a port outside [data-ports], with no attribution beside it"),

    ("M4-attribution-stripped", PAGE,
     "Those are the <strong>Monero node addon&rsquo;s</strong> ports",
     "Those are the <strong>exposed</strong> ports",
     "§6g attribution — nothing says WHOSE ports these are"),

    ("M5-i2p-as-available", PAGE,
     '["transports", "Tor is bundled. I2P is NOT — upstream leaves the i2pd daemon commented out, so do not plan around it."],',
     '["transports", "Tor and I2P are both bundled."],',
     "§6h — I2P listed as an available transport"),

    ("M6-csp-reason-dropped", PAGE,
     "is <code>connect-src &lsquo;self&rsquo;</code>, so the browser is not permitted to",
     "is strict, so the browser is not permitted to",
     "§6d reason 1 — the CSP reason no longer named"),

    ("M7-quote-paraphrased", PAGE,
     '"superstress is self-hosted, the monero node add[on] exposes 18081 p2p 18083 zmq-pub (for p2pool) 18089 (restricted) and is reachable from lan/tor/tailscale"',
     '"Superstress is self-hosted. The Monero node addon exposes ports 18081, 18083 and 18089, and is reachable from LAN, Tor or Tailscale."',
     "§6i verbatim — a tidied paraphrase presented as his words"),

    ("M8-forward-rule-deleted", PAGE,
     '<span className="mono" style={{ color: "var(--y-50)" }}>BETANET · NOT MAINNET · TEST FUNDS ONLY</span>{" "}',
     '<span className="mono" style={{ color: "var(--y-50)" }}>a clear label</span>{" "}',
     "§6e — the banner rule no longer recorded"),

    ("M9-permanence-dropped", PAGE,
     "There is no public endpoint for the beta chain, none is planned, and the chain is\n            self-hosted by design rather than by delay.",
     "There is no public endpoint for the beta chain right now.",
     "§6c permanence AND §6c self-hosted — 'not yet' re-opens the question"),

    ("M10-prereq-row-dropped", PAGE,
     "{PREREQ.map(([k, v]) => (",
     "{PREREQ.slice(0, 3).map(([k, v]) => (",
     "§6h — source declares 7 rows, the page renders 3"),

    ("M11-VACUITY-CONTROL", PAGE,
     "it states the answer",  # sentinel that never matches — see note below
     "",
     "(handled specially)"),
]


def run(cmd, cwd=APP, check=False):
    return subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)


def build():
    r = run("npm run build")
    if r.returncode != 0:
        print("BUILD FAILED:\n" + r.stdout[-3000:] + r.stderr[-3000:])
        return False
    return True


def gate():
    r = run("node verify-superstress.mjs")
    out = r.stdout + r.stderr
    reds = [l.strip() for l in out.splitlines() if l.strip().startswith("❌")]
    summary = [l.strip() for l in out.splitlines() if "verify-superstress:" in l]
    return r.returncode, reds, summary


def committed_blob_matches(path):
    rel = os.path.relpath(path, APP.parent)
    r = run(f"git show HEAD:{rel}", cwd=APP.parent)
    return r.stdout == pathlib.Path(path).read_text()


def marker_sweep():
    r = run("grep -rn 'MUTATION\\|BREAK TEST' src *.mjs", cwd=APP)
    return r.stdout.strip()


def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    results = []
    for mid, path, find, repl, expect in MUTATIONS:
        if mid == "M11-VACUITY-CONTROL":
            continue
        if only and mid not in only:
            continue
        src = path.read_text()
        n = src.count(find)
        if n != 1:
            print(f"\n### {mid}: ANCHOR MATCHED {n} TIMES — mutation NOT applied (need exactly 1). SKIPPED.")
            results.append((mid, "ANCHOR-FAIL", [], ""))
            continue
        path.write_text(src.replace(find, repl))
        assert path.read_text() != src, f"{mid}: replace was a NO-OP"
        print(f"\n### {mid} — expect: {expect}")
        if not build():
            path.write_text(src)
            results.append((mid, "BUILD-FAIL", [], ""))
            continue
        code, reds, summary = gate()
        print(f"  exit={code}  summary={summary}")
        for l in reds:
            print("   " + l)
        # RESTORE, then prove it against the COMMITTED BLOB
        run(f"git checkout -- {os.path.relpath(path, APP.parent)}", cwd=APP.parent)
        ok_blob = committed_blob_matches(path)
        print(f"  restore == committed blob: {ok_blob}")
        results.append((mid, f"exit={code} reds={len(reds)}", reds, summary[0] if summary else ""))

    print("\n=== marker sweep (bracketed; empty between markers means CLEAN) ===")
    print("<<<" + marker_sweep() + ">>>")
    print("\n=== git status (bracketed) ===")
    print("<<<" + run("git status --short", cwd=APP.parent).stdout.strip() + ">>>")
    print("\n=== SUMMARY ===")
    for mid, verdict, reds, summ in results:
        print(f"{mid:28s} {verdict:22s} {summ}")
    print("\n### REBUILDING clean tree so the next measurement is not of a mutated dist")
    build()
    code, reds, summary = gate()
    print(f"CLEAN RE-RUN: exit={code} {summary}")


if __name__ == "__main__":
    main()
