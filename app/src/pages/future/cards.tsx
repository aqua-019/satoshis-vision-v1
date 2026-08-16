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
 * RepoPulseReadout  — the live readout markup, so DevLabPulseCard and (via
 *                     TrustedPeersPage) any partner card whose EcoEntry
 *                     carries a `repo` (today: Superbrain) render the same
 *                     star/issue/push/issue-age signal without duplicating
 *                     it. Defined in ./repoPulse.tsx, NOT here — see that
 *                     file's header for why: the first time a second surface
 *                     imported it out of this module, Rollup chunked this
 *                     WHOLE file (ProtocolCard, MoneroNewsCard, and their own
 *                     imports included) into that surface's closure. Imported
 *                     and re-exported below so every existing
 *                     `import { RepoPulseReadout } from "./cards"` (and
 *                     `{ FeedEmpty }`, ProtoPopup's) keeps resolving —
 *                     TrustedPeersPage now imports the leaf directly instead.
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
  useRepoPulse, useMrlIssues, useMoneroBlog, repoPulseEndpoint,
  agoStr, isStale, FEED_PROXY,
} from "@/data/useCachedFeed";
import type { FutureProtocol } from "./data";
import { RepoPulseReadout, FeedEmpty } from "./repoPulse";
export { RepoPulseReadout, FeedEmpty };

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
  const { pulse, state: pulseState } = useRepoPulse(p.repo);
  const stale = pulse ? isStale(pulse.pushed) : false;
  const pulseFailed = pulseState === "fail" && !pulse;

  return (
    <Card onClick={onOpen} style={{ padding: 22, minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {/* `data-pulse` is the deterministic "this repo's fetch has resolved"
          hook the DOM gate waits on, replacing a networkidle heuristic.
          It sits here rather than on <Card> because Card takes a fixed prop
          set and does not spread — see design/primitives.tsx. Note this
          element is `display: contents`, so it has no box: query it with
          querySelectorAll/count, never with a visibility-based wait. */}
      {/* `data-pulse-state` carries the raw FeedState; `data-pulse` keeps its
          original two values because verify-future.mjs waits on
          [data-pulse="live"], and a warm cache emitting a third value there
          would hang that gate for its full timeout. */}
      <div className="v6-future-card" data-pulse={pulse ? "live" : "pending"} data-pulse-state={pulseState}>
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
            {p.repo}
            {pulse
              ? <> · ★{pulse.stars.toLocaleString()} · {agoStr(pulse.pushed)}</>
              : pulseFailed
                ? <span style={{ color: "var(--y-50)" }}> · <code>{repoPulseEndpoint(p.repo)}</code> unreachable</span>
                : " · pinging…"}
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
  const { pulse, state } = useRepoPulse(repo);

  return (
    <div
      className="panel"
      // The DOM gate waits on data-pulse="live" instead of a network
      // heuristic, and counts data-pulse-repo to prove all four rows fetched.
      data-pulse-repo={repo}
      data-pulse={pulse ? "live" : "pending"}
      data-pulse-state={state}
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
      <RepoPulseReadout repo={repo} />
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
