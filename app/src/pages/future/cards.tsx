/**
 * pages/future/cards.tsx — the FUTURE tab's live cards.
 *
 * ProtocolCard      — one of the five incoming upgrades. Pings its repo ON
 *                     MOUNT, so the grid itself carries live signal instead
 *                     of staying inert until someone opens a modal.
 * DevLabPulseCard   — always-on readout for the four repos on the automation
 *                     registry's pulse row (DEV_LAB_PULSES in data.ts). Push
 *                     age and issue age are SEPARATE readouts: a repo nobody
 *                     pushes to can still have live issue discussion, and
 *                     one combined badge reported that as a dead repo.
 * MoneroNewsCard    — getmonero.org announcements + MRL research-lab issue
 *                     traffic, both 24h-cached and stamped with their age.
 *
 * Every number here comes from a real source through the same-origin
 * /api/feeds proxy. Nothing on this page is synthesized: when a feed has no
 * data we say which endpoint failed, never render an empty panel, and never
 * substitute a plausible-looking placeholder.
 */

import * as React from "react";
import { Link } from "react-router-dom";

import { Card } from "@/design/primitives";
import {
  useRepoPulse, useMrlIssues, useMoneroBlog,
  agoStr, isStale, FEED_PROXY,
  type FeedState,
} from "@/data/useCachedFeed";
import type { FutureProtocol } from "./data";

/** "updated 4h ago" for a cache timestamp, or "" before anything is cached. */
function stamp(at: number | null): string {
  return at ? "updated " + agoStr(new Date(at).toISOString()) : "";
}

/* ── one protocol card ──────────────────────────────────────────── */

export interface ProtocolCardProps {
  p: FutureProtocol;
  onOpen: () => void;
  /** True only for the brief window (see FuturePage.tsx's `morph` state)
   *  this card's title is the SOURCE of the card→modal shared-element
   *  morph — never true once the popup for this same id is open, so the
   *  name is never on both the card and the modal at once. */
  morphed?: boolean;
}

export function ProtocolCard({ p, onOpen, morphed }: ProtocolCardProps) {
  const pulse = useRepoPulse(p.repo);
  const stale = pulse ? isStale(pulse.pushed) : false;

  return (
    <Card onClick={onOpen} style={{ padding: 22, minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {/* `data-pulse` is the deterministic "this repo's fetch has resolved"
          hook the DOM gate waits on, replacing a networkidle heuristic.
          It sits here rather than on <Card> because Card takes a fixed prop
          set and does not spread — see design/primitives.tsx. Note this
          element is `display: contents`, so it has no box: query it with
          querySelectorAll/count, never with a visibility-based wait. */}
      <div className="v6-future-card" data-pulse={pulse ? "live" : "pending"}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span className="v6-status" style={{ color: p.sc }}>
              <span className="led pulse" style={{ background: p.sc, boxShadow: `0 0 8px ${p.sc}`, margin: 0 }} />
              {p.status}
            </span>
            {/* "push quiet", not "repo quiet": pushed_at is the only signal
                this badge measures, and a repo can be push-quiet while its
                issues are busy. */}
            {stale && pulse ? <span className="mono" style={{ fontSize: "var(--fs-label)", color: "var(--y-50)" }}>push quiet · {agoStr(pulse.pushed)}</span> : null}
          </div>
          <h3
            className="serif"
            style={{
              margin: "14px 0 4px",
              fontSize: "clamp(24px, 1.9vw, 34px)",
              fontWeight: 400,
              color: p.c,
              textShadow: `0 0 16px ${p.c}55`,
              // §6 shared-element morph source. `undefined` (not a
              // conditional key) so React drops the property entirely when
              // not morphing, rather than assigning an empty string name.
              viewTransitionName: morphed ? "proto-title" : undefined,
            }}
          >
            {p.tag}
          </h3>
          <div className="kicker" style={{ marginBottom: 10 }}>{p.sub} · ETA {p.eta}</div>
          <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>{p.lede}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <span className="mono dim2" style={{ fontSize: "var(--fs-mono)", letterSpacing: "0.1em" }}>
            {p.repo}{pulse ? <> · ★{pulse.stars.toLocaleString()} · {agoStr(pulse.pushed)}</> : " · pinging…"}
          </span>
          <span className="open-cue">open window →</span>
        </div>
      </div>
    </Card>
  );
}

/* ── dev-lab pulse ──────────────────────────────────────────────── */

export interface DevLabPulseCardProps {
  repo: string;
  label: string;
  /** Where the repo slug links. A leading "/" renders an in-app <Link>
   *  (this site's own row goes to /sources, where its release feed lives);
   *  anything else renders an external anchor. Deriving the link kind from
   *  the href itself means there is no second prop that can disagree. */
  href: string;
}

export function DevLabPulseCard({ repo, label, href }: DevLabPulseCardProps) {
  const pulse = useRepoPulse(repo);
  // Two INDEPENDENT staleness reads. Before v6.1.1 one badge derived from
  // pushed_at spoke for the whole repo, so monero-project/research-lab —
  // which nobody pushes to, but whose issues carry the actual MRL
  // discussion — rendered as "repo quiet · 485d ago". That told visitors
  // Monero research had stopped, which is false. Push age and issue age are
  // different facts and now read as different lines.
  const pushStale = pulse ? isStale(pulse.pushed) : false;
  const issueStale = pulse ? isStale(pulse.issueAt) : false;

  return (
    <div
      className="panel"
      // The DOM gate waits on data-pulse="live" instead of a network
      // heuristic, and counts data-pulse-repo to prove all four rows fetched.
      data-pulse-repo={repo}
      data-pulse={pulse ? "live" : "pending"}
      style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span className="mono dim2" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
        {href.startsWith("/") ? (
          <Link className="mono dim2" to={href} style={{ fontSize: "var(--fs-mono)" }}>{repo} →</Link>
        ) : (
          <a className="mono dim2" href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--fs-mono)" }}>{repo} ↗</a>
        )}
      </div>
      {pulse ? (
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
        <div className="mono dim2" style={{ fontSize: "var(--fs-mono)" }}>fetching via /api/feeds …</div>
      )}
    </div>
  );
}

/* ── empty states — visible, specific, never fabricated ─────────── */

function FeedEmpty({ state, endpoint, what }: { state: FeedState; endpoint: string; what: string }) {
  if (state === "load" || state === "cached") {
    return <div className="mono dim2" style={{ fontSize: "var(--fs-mono)" }}>fetching…</div>;
  }
  return (
    <div className="mono" style={{ fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--y-50)", border: "1px dashed var(--ink-20)", padding: "10px 12px" }}>
      <code>{endpoint}</code> returned no data — {what} is fetched server-side and failed
      upstream. Nothing cached yet; this retries on your next visit.
    </div>
  );
}

/* ── fork status / ETAs + dev labs · the live news surface ───────── */

export function MoneroNewsCard() {
  const { posts, at: postAt, state: postState } = useMoneroBlog(5);
  const { issues, at: issAt, state: issState } = useMrlIssues(6);

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div className="kicker">Fork status · ETAs · dev labs — refreshed every 24h</div>
        <span className="mono dim2" style={{ fontSize: "var(--fs-mono)" }}>getmonero.org · monero-project/research-lab</span>
      </div>

      <div className="col-2" style={{ gap: 22 }}>
        {/* getmonero.org announcements */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-60)" }}>Announcements</span>
            <span className="mono dim2" style={{ fontSize: "var(--fs-mono)" }}>{stamp(postAt)}</span>
          </div>
          {posts && posts.length ? posts.map((p) => (
            <a
              key={p.url}
              className="v6-res"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              <span className="mono dim2" style={{ fontSize: "var(--fs-mono)", flexShrink: 0 }}>{(p.date || "").slice(0, 10)}</span>
            </a>
          )) : (
            <FeedEmpty state={postState} endpoint={`${FEED_PROXY}?src=getmonero`} what="getmonero.org's Atom feed" />
          )}
          <a className="mono dim2" href="https://www.getmonero.org/blog/" target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--fs-mono)", marginTop: 2 }}>all announcements ↗</a>
        </div>

        {/* MRL issue traffic */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-60)" }}>MRL · research lab</span>
            <span className="mono dim2" style={{ fontSize: "var(--fs-mono)" }}>{stamp(issAt)}</span>
          </div>
          {issues && issues.length ? issues.map((i) => (
            <a
              key={i.n}
              className="v6-res"
              href={i.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--ink-40)" }}>#{i.n}</span> {i.t}
              </span>
              <span className="mono dim2" style={{ fontSize: "var(--fs-mono)", flexShrink: 0 }}>{agoStr(i.u)}</span>
            </a>
          )) : (
            <FeedEmpty state={issState} endpoint={`${FEED_PROXY}?src=mrl`} what="the research-lab issue list" />
          )}
          <a className="mono dim2" href="https://github.com/monero-project/research-lab/issues" target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--fs-mono)", marginTop: 2 }}>all MRL issues ↗</a>
        </div>
      </div>

      {/* The two X accounts. Naming them is deliberate — silently dropping
          them reads as an oversight. What they are NOT is a pending
          integration waiting on a purchase: X publishes no unauthenticated
          read API, so these are link-outs and that is the finished design,
          not a stalled one. */}
      <div style={{ borderTop: "1px solid var(--rule)", marginTop: 16, paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="mono dim2" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Also tracked</span>
        <a className="v6-res" href="https://x.com/monero" target="_blank" rel="noopener noreferrer">@monero ↗</a>
        <a className="v6-res" href="https://x.com/MoneroResearchL" target="_blank" rel="noopener noreferrer">@MoneroResearchL ↗</a>
        <span className="mono dim2" style={{ fontSize: "var(--fs-body)" }}>
          · link-out only — X has no unauthenticated read API, so these stay links rather than an ingested feed
        </span>
      </div>
    </Card>
  );
}
