/**
 * pages/future/repoPulse.tsx — the live GitHub-repo-pulse readout, as its
 * own leaf. Exports `FeedEmpty` and `RepoPulseReadout` and nothing else.
 *
 * WHY THIS IS A SEPARATE FILE, NOT PART OF cards.tsx.
 *
 * `RepoPulseReadout` used to live inside cards.tsx alongside `ProtocolCard`,
 * `DevLabPulseCard` and `MoneroNewsCard`. The first time a second surface
 * (TrustedPeersPage's Superbrain card) imported anything from cards.tsx,
 * Rollup chunked the WHOLE module — every export, because chunking operates
 * on files, not on individual exports — into the chunk shared between
 * FuturePage and TrustedPeersPage. Measured on that build: `/about/peers`'s
 * first-load closure rose to 101,152 B gzip against a 100,000 B ceiling,
 * because that route was now paying for `ProtocolCard` and `MoneroNewsCard`
 * (and their own imports: react-router-dom's `Link`, `useMrlIssues`,
 * `useMoneroBlog`, `FEED_PROXY`) even though it renders neither.
 *
 * This is the exact shape `design/canvasColor.ts` was already split out of
 * `design/chart-kit.tsx` to prevent — see that file's own header and
 * CLAUDE.md's "CSS custom property → canvas colour" row: a leaf homed inside
 * a fat module costs every importer of that module, not just the leaf's own
 * callers, the instant a second importer shows up. The fix there was the fix
 * here: re-home the leaf, keep every existing import path working via a
 * re-export from the fat module, and have the NEW caller import the leaf
 * directly rather than through the module that no longer needs to carry it.
 *
 * This file must import ONLY what the readout itself needs — never
 * `ProtocolCard`, `MoneroNewsCard`, `FutureMini`, `react-router-dom`, or
 * anything else that would pull cards.tsx's other exports back in through a
 * cycle. `cards.tsx` imports `RepoPulseReadout`/`FeedEmpty` from HERE (one
 * direction only) and re-exports them, so `ProtoPopup.tsx`'s existing
 * `import { FeedEmpty } from "./cards"` and any future
 * `import { RepoPulseReadout } from "./cards"` keep resolving unchanged.
 * `TrustedPeersPage.tsx` imports straight from this file — that is the whole
 * point; importing via cards.tsx would re-merge the fat module into the
 * peers closure and reproduce the regression this file exists to prevent.
 */

import { useRepoPulse, agoStr, isStale, repoPulseEndpoint, type FeedState } from "@/data/useCachedFeed";

/* ── empty states — visible, specific, never fabricated ─────────── */

export function FeedEmpty({ state, endpoint, what }: { state: FeedState; endpoint: string; what: string }) {
  if (state === "load" || state === "cached") {
    return <div className="mono dim2" style={{ fontSize: "var(--fs-mono)" }}>fetching…</div>;
  }
  return (
    /* overflowWrap:"anywhere" is load-bearing, not tidiness. `endpoint` is a
       query-string URL with no spaces, so it is ONE unbreakable token: in
       /future's wide col-2 panel it fits and nothing shows, but in the ~290px
       /about/peers partner card it ran straight out of this dashed box and was
       clipped at the card edge. Found by looking at the degraded render — no
       gate sees it, because the box does not overflow the PAGE (the card clips
       it), so a scrollWidth check reads zero while the text is unreadable. */
    <div className="mono" style={{ fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--y-50)", border: "1px dashed var(--ink-20)", padding: "10px 12px", overflowWrap: "anywhere" }}>
      <code>{endpoint}</code> returned no data — {what} is fetched server-side and failed
      upstream. Nothing cached yet; this retries on your next visit.
    </div>
  );
}

/**
 * The live star/issue/push/issue-age readout — shared by DevLabPulseCard
 * (the /future automation registry's four rows) and TrustedPeersPage (any
 * partner card whose EcoEntry carries a `repo`, today only Superbrain).
 * `DevLabPulseCard` still calls `useRepoPulse` itself, for its own
 * `data-pulse`/`data-pulse-state` attributes — a second call for the same
 * repo here costs no extra request, because `useCachedFeed`'s `fetchOnce`
 * dedupes in-flight/cached requests by cache id at module scope
 * (data/useCachedFeed.ts), not by call site.
 *
 * HARD REQUIREMENT (verify-future.mjs): this must emit exactly the DOM the
 * inline ternary used to before the first extraction — same elements, same
 * data-readout attributes, same text — so DevLabPulseCard's rendered output
 * stays byte-identical across BOTH moves (into cards.tsx, then out again
 * into this leaf).
 */
export function RepoPulseReadout({ repo }: { repo: string }) {
  const { pulse, state } = useRepoPulse(repo);
  // Two INDEPENDENT staleness reads. Before v6.1.1 one badge derived from
  // pushed_at spoke for the whole repo, so monero-project/research-lab —
  // which nobody pushes to, but whose issues carry the actual MRL
  // discussion — rendered as "repo quiet · 485d ago". That told visitors
  // Monero research had stopped, which is false. Push age and issue age are
  // different facts and now read as different lines.
  const pushStale = pulse ? isStale(pulse.pushed) : false;
  const issueStale = pulse ? isStale(pulse.issueAt) : false;

  return pulse ? (
    // flexWrap so four readouts still fit at 390px, where .col-2 is 1-up.
    <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-80)", display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <span>★ {pulse.stars.toLocaleString()}</span>
      {/* GitHub's open_issues_count counts open PRs as issues. Saying
          "issues N" without that caveat overstates the number. */}
      <span>open issues {pulse.issues} <span className="dim2">(incl. PRs)</span></span>
      {/* data-readout makes each signal individually addressable by the
          DOM gate, instead of a whitespace-fragile innerText regex. */}
      <span data-readout="push" style={{ color: pushStale ? "var(--y-50)" : "var(--g-50)" }}>
        last push · {agoStr(pulse.pushed)}{pushStale ? " · quiet" : ""}
      </span>
      {/* A repo with no issue activity reports "—" in dim, never green:
          absence of data is not a healthy reading. */}
      <span data-readout="issue" style={{ color: pulse.issueAt ? (issueStale ? "var(--y-50)" : "var(--g-50)") : "var(--ink-40)" }}>
        last issue activity · {agoStr(pulse.issueAt)}{pulse.issueAt && issueStale ? " · quiet" : ""}
      </span>
    </div>
  ) : (
    <FeedEmpty state={state} endpoint={repoPulseEndpoint(repo)} what="this repo's GitHub pulse" />
  );
}
