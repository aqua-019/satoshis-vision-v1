/**
 * pages/future/ProtocolDetail.tsx — the protocol deep-dive BODY, shared by the
 * /future modal and the /future/protocol page.
 *
 * ── WHY THIS EXISTS (p4·06) ─────────────────────────────────────────────
 * The five Future-dropdown protocol rows used to be `${R.FUTURE}#<id>`, and
 * #184 measured that /future renders no panel any of them can scroll to —
 * every one was hollow. They now key `/future/protocol?p=<id>`, which means
 * this content had to exist as a PAGE as well as a dialog.
 *
 * The brief said to promote the popup's content and SHARE the rendering, never
 * fork the data. Sharing the whole popup was measured and refused: `V6Modal`
 * portals to document.body, sets role="dialog", installs a focus trap plus
 * focus capture/restore, a document-level Escape handler and a two-target
 * scroll lock on `document.body` AND `main.main`. It has no inline mode, and
 * giving it one to render a page inside a page is a larger change than this.
 *
 * So the seam is the BODY, and it is drawn where the dialog stops being a
 * dialog. `ProtoPopup` keeps the `v6-modal-head` (the ✕ button and the
 * shared-element morph target `proto-title`, both meaningless on a page);
 * the page supplies a `PageHeader` instead. Everything below that line — the
 * deep paragraphs, the mini-visualization, the metrics grid, the simulator
 * CTA, the resources row and the repo pulse — is this file, rendered
 * identically by both. The JSX was MOVED, not retyped.
 *
 * ── THE ONE PARAMETER, AND WHY IT IS NOT `onClose` ──────────────────────
 * Two controls in here navigate away: the simulator CTA and any resource whose
 * href starts with "/" (an in-app route rather than an outbound tab). Inside a
 * dialog those must close it first; on a page there is nothing to close.
 * `onNavigate` is that hook, and it defaults to a no-op so the page passes
 * nothing. Naming it `onClose` on a page would be a prop that lies.
 *
 * ── IMPORT NOTE THAT HAS COST BYTES BEFORE ──────────────────────────────
 * `FeedEmpty` is imported from `./repoPulse`, its actual home, NOT from
 * `./cards` — which merely re-exports it. Rollup chunks per MODULE, so
 * routing this one import through cards.tsx drags `ProtocolCard` and
 * `MoneroNewsCard` into every importer's closure. That exact mistake once put
 * /about/peers at 101,152 B against a 100,000 B ceiling; see repoPulse.tsx's
 * header. ProtoPopup imported it from `./cards` and does not any more.
 */

import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

import { useRepoPulse, agoStr, isStale, repoPulseEndpoint } from "@/data/useCachedFeed";
import { FeedEmpty } from "./repoPulse";
import { FutureMini } from "./FutureMini";
import { SIM_IDS, type FutureProtocol } from "./data";
import { R } from "../../../scripts/routes.mjs";

export interface ProtocolDetailProps {
  p: FutureProtocol;
  /** Called immediately before this component navigates the app somewhere
   *  else. The dialog passes its own close; the page passes nothing. */
  onNavigate?: () => void;
}

export function ProtocolDetail({ p, onNavigate }: ProtocolDetailProps) {
  const navigate = useNavigate();
  const { pulse, at: pulseAt, state: pulseState } = useRepoPulse(p.repo);
  const hasSim = p.sim !== null && SIM_IDS.has(p.sim);
  const stale = pulse ? isStale(pulse.pushed) : false;
  const leave = onNavigate ?? (() => {});

  return (
    <div className="v6-modal-body">
      <div className="col-2" style={{ gridTemplateColumns: "1.25fr 1fr", gap: 26, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* p4·M5 — "you can run this today", when that is true. It leads
              because it is the only thing on a protocol card a reader can act
              on now; everything below it is about a thing that does not exist
              yet. Rendered from `p.live`, whose PRESENCE is also what puts
              this card in /future's "live to try" band — one field, so the
              band and the sentence cannot disagree. */}
          {p.live ? (
            <div
              data-proto-live
              className="mono"
              style={{
                fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--ink-80)",
                borderLeft: `2px solid ${p.c}`, paddingLeft: 12,
              }}
            >
              <div className="kicker" style={{ color: p.c, marginBottom: 6 }}>Runnable today</div>
              {p.live}
            </div>
          ) : null}
          {p.deep.map((par, i) => (
            <p key={i} className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>{par}</p>
          ))}
          {/* p4·M5 — THE REVIEW, AS CONTENT. Both audit links already shipped
              in `resources` below; a filename is not a finding, and a reader
              should not have to open a PDF to learn the result.

              Three things are structural rather than styling:
              · the SCOPE renders directly under the heading, because the
                defect this block guards against is "audited" being read as a
                claim about the whole protocol or about the network;
              · the DATE renders beside the reviewer, never omitted — the
                whole value of a finding is which artifact, when;
              · the link is to the REPORT, so every sentence above is
                checkable. It carries no "↗ audit" kind label because it is
                not one of `resources`' chips — it is the citation for the
                block it sits in. */}
          {p.review ? (
            <div
              data-proto-review
              style={{ borderTop: "1px solid var(--rule)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div className="kicker">
                Independent review · <span style={{ color: p.c }}>{p.review.by}</span> · {p.review.dated}
              </div>
              <p className="mono dim2" style={{ margin: 0, fontSize: "var(--fs-label)", lineHeight: 1.7, letterSpacing: "0.02em" }}>
                <span data-review-scope>Scope: {p.review.scope}</span>
              </p>
              {p.review.lines.map((line, i) => (
                <p key={i} className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>{line}</p>
              ))}
              <a className="v6-res" href={p.review.href} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start" }}>
                <span className="led" style={{ background: p.c, boxShadow: `0 0 6px ${p.c}` }} />
                Read the report ↗
              </a>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FutureMini mode={p.mini} height={224} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            {p.metrics.map(([k, v]) => (
              <div key={k} className="stat">
                <div className="lbl">{k}</div>
                <div className="val" style={{ fontSize: 15, color: p.c }}>{v}</div>
              </div>
            ))}
          </div>
          {hasSim ? (
            <button
              type="button"
              className="proto-btn"
              onClick={() => { leave(); navigate(`${R.LEARN_SIM}?p=` + p.sim); }}
              style={{ borderColor: p.c, color: p.c, boxShadow: `0 0 10px ${p.c}44` }}
            >
              ▶ RUN THE {p.tag.toUpperCase()} SIMULATOR
            </button>
          ) : (
            <button
              type="button"
              className="proto-btn"
              disabled
              title={`No ${p.tag} simulator exists yet — the /simulate chunk registers ${SIM_IDS.size} protocols and this is not one of them.`}
              style={{ borderColor: "var(--y-50)", color: "var(--y-50)" }}
            >
              {p.tag.toUpperCase()} SIMULATOR PENDING
            </button>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 18, display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
        <div>
          <div className="kicker" style={{ marginBottom: 10 }}>Community resources · canonical sources</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* p3·16 — same leading-"/" split as EcoPopup's link row, and
                the same reason: a resource on THIS site is a route, not an
                external tab. The "↗" is part of the claim, so the in-app
                branch drops it rather than promising an outbound hop the
                link does not make. Closing the dialog is part of the
                navigation — see EcoPopup for the full note. */}
            {p.resources.map(([label, href, kind]) => (
              href.startsWith("/") ? (
                <Link key={href} className="v6-res" to={href} onClick={leave}>
                  <span className="led" style={{ background: p.c, boxShadow: `0 0 6px ${p.c}` }} />
                  {label} <span style={{ color: "var(--ink-40)" }}>· {kind} →</span>
                </Link>
              ) : (
                <a key={href} className="v6-res" href={href} target="_blank" rel="noopener noreferrer">
                  <span className="led" style={{ background: p.c, boxShadow: `0 0 6px ${p.c}` }} />
                  {label} <span style={{ color: "var(--ink-40)" }}>· {kind} ↗</span>
                </a>
              )
            ))}
          </div>
        </div>
        <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-40)", textAlign: "right", lineHeight: 1.8 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Live repo pulse · {p.repo}</div>
          {pulse ? (
            <>
              {/* open_issues_count includes open PRs — same caveat as the
                  automation registry's pulse rows carry. */}
              <div>★ <b style={{ color: "var(--ink-80)" }}>{pulse.stars.toLocaleString()}</b> · open issues <b style={{ color: "var(--ink-80)" }}>{pulse.issues}</b> (incl. PRs)</div>
              <div>
                last push <b style={{ color: stale ? "var(--y-50)" : "var(--g-50)" }}>{agoStr(pulse.pushed)}</b>
                {/* "push quiet", not "repo quiet": pushed_at is all this
                    measures, and a push-quiet repo can still be busy. */}
                {stale ? " · push quiet" : ""}
                {/* p4·M5 — THE AGE OF THE READING, MEASURED, replacing the
                    claim "refreshed every 24h via /api/feeds". That sentence
                    described a policy, and the policy was not what the reader
                    was looking at: the edge cached this payload for up to a
                    day before the browser cached it for another, so a figure
                    presented as fresh-within-24h could be twice that. `at` is
                    the moment THIS cache entry was written and has been
                    returned by useCachedFeed all along — this surface was
                    discarding it. A number that states its own age cannot go
                    silently stale, which is the same reason every panel on
                    this site carries a provenance stamp. */}
                {pulseAt ? <> · read <b style={{ color: "var(--ink-80)" }}>{agoStr(new Date(pulseAt).toISOString())}</b> via /api/feeds</> : " · via /api/feeds"}
              </div>
            </>
          ) : (
            <div data-pulse-state={pulseState}>
              <FeedEmpty
                state={pulseState}
                endpoint={repoPulseEndpoint(p.repo)}
                what="this repo's GitHub pulse"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
