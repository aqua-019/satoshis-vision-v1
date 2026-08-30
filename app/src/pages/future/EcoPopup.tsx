/**
 * pages/future/EcoPopup.tsx — the ecosystem/partner brief dialog.
 *
 * Shared by FuturePage (the stressnet band) and TrustedPeersPage (the `our
 * brief` footer button on each partner card). Lives here rather than beside
 * either page so neither has to import the other — and so TrustedPeersPage
 * never transitively pulls in FutureMini's canvas code.
 *
 * v6.0.1 addition: when the entry carries a `url`, the dialog grows a
 * VISIT <NAME> ↗ anchor. Partner cards now open the partner's own site on
 * body click, so this dialog is the in-site brief that click used to show —
 * nothing that was reachable before became unreachable.
 */

import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

import { V6Modal } from "./V6Modal";
import { SIM_IDS, type EcoEntry } from "./data";
import { R } from "../../../scripts/routes.mjs";

export interface EcoPopupProps {
  e: EcoEntry;
  /** D0666: showing, not mounted — see ProtoPopup's identical prop. Both
   *  consumers (FuturePage's stressnet band, TrustedPeersPage's "our brief")
   *  retain the last entry and flip this, so V6Modal gets to play its exit
   *  before it unmounts itself. */
  open: boolean;
  onClose: () => void;
}

/** `/simulate?p=<id>` → <id>, so a simLink can be gated on SIM_IDS the same
 *  way ProtoPopup gates its button. SimulatePage silently falls back to the
 *  decoy sim for an unknown ?p=, so an unregistered link would mislead. */
function simIdOf(simLink: string | undefined): string | null {
  if (!simLink) return null;
  const id = simLink.split("?p=")[1];
  return id && SIM_IDS.has(id) ? id : null;
}

export function EcoPopup({ e, open, onClose }: EcoPopupProps) {
  const navigate = useNavigate();
  const titleId = React.useId();
  const simId = simIdOf(e.simLink);

  return (
    <V6Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="v6-modal-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="v6-status" style={{ color: e.c }}>
              <span className="led pulse" style={{ background: e.c, boxShadow: `0 0 8px ${e.c}`, margin: 0 }} />
              {e.status}
            </span>
            <span className="kicker">{e.kind}</span>
          </div>
          <h2
            id={titleId}
            className="serif"
            style={{ margin: 0, fontSize: "clamp(26px, 2.4vw, 40px)", fontWeight: 400, color: "var(--ink-100)" }}
          >
            <em style={{ fontStyle: "normal", color: e.c, textShadow: `0 0 14px ${e.c}66` }}>{e.name}</em> — {e.head}
          </h2>
        </div>
        <button type="button" className="v6-x" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="v6-modal-body">
        <div className="col-2" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {e.body.map((par, i) => (
              <p key={i} className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>{par}</p>
            ))}
            {e.blocks?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {e.blocks.map((blk, bi) => {
                  // A single-line unordered block reads as a command, not a
                  // list — render it as one bordered mono line instead of a
                  // one-item bullet.
                  const asCommand = !blk.ordered && blk.lines.length === 1;
                  const ListTag: "ol" | "ul" = blk.ordered ? "ol" : "ul";
                  return (
                    <div key={bi}>
                      <div className="kicker" style={{ marginBottom: 8 }}>{blk.label}</div>
                      {asCommand ? (
                        <div
                          className="mono"
                          style={{
                            fontSize: "var(--fs-mono)",
                            color: "var(--ink-80)",
                            background: "var(--bg-2)",
                            border: "1px solid var(--rule)",
                            padding: "8px 12px",
                          }}
                        >
                          {blk.lines[0]}
                        </div>
                      ) : (
                        <ListTag
                          className="mono"
                          style={{ margin: 0, paddingLeft: 20, fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--ink-80)" }}
                        >
                          {blk.lines.map((line, li) => (
                            <li key={li} style={{ marginBottom: li === blk.lines.length - 1 ? 0 : 6 }}>{line}</li>
                          ))}
                        </ListTag>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {simId ? (
              <button
                type="button"
                className="proto-btn"
                onClick={() => { onClose(); navigate(`${R.LEARN_SIM}?p=` + simId); }}
                style={{ alignSelf: "flex-start", borderColor: e.c, color: e.c, boxShadow: `0 0 10px ${e.c}44` }}
              >
                ▶ {e.simLabel}
              </button>
            ) : null}
            {/* p4·M5 — a SECOND primary control, beside the simulator CTA.
                It is a <button> routed through `navigate`, not an <a href>,
                because a leading-"/" destination is an in-app route and this
                dialog must close before the app navigates under it — the same
                two-step `links[]` and `resources[]` already perform, and the
                same reason: a modal left open over the route it just sent you
                to is the defect one layer up.

                An off-site `ctaLink` renders as a real anchor instead, so the
                field stays honest for a destination that is not this site.
                Today only the stressnet entry uses it, and its link is
                in-app. */}
            {e.ctaLink && e.ctaLabel ? (
              e.ctaLink.startsWith("/") ? (
                <button
                  type="button"
                  className="proto-btn"
                  data-eco-cta={e.id}
                  onClick={() => { onClose(); navigate(e.ctaLink as string); }}
                  style={{ alignSelf: "flex-start", borderColor: e.c, color: e.c, boxShadow: `0 0 10px ${e.c}44` }}
                >
                  {e.ctaLabel} →
                </button>
              ) : (
                <a
                  className="proto-btn"
                  data-eco-cta={e.id}
                  href={e.ctaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ alignSelf: "flex-start", borderColor: e.c, color: e.c, boxShadow: `0 0 10px ${e.c}44` }}
                >
                  {e.ctaLabel} ↗
                </a>
              )
            ) : null}
            {e.url ? (
              <a
                className="proto-btn"
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ alignSelf: "flex-start", borderColor: e.c, color: e.c, boxShadow: `0 0 10px ${e.c}44` }}
              >
                VISIT {e.name.toUpperCase()} ↗
              </a>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* p4·M3 — THE REAL SCREENSHOT, above whatever is still reserved.
                Four things here are load-bearing and none is styling:

                `width`/`height` ARE THE INTRINSIC PIXELS (every capture is
                1000x625), so the browser reserves the aspect-ratio box before
                a byte of image arrives and the paragraph beside it never
                jumps. Without them a lazy image is a layout shift by
                construction, which this repo caps at 0.005.

                `loading="lazy"` IS NOT WHAT KEEPS IT OFF FIRST PAINT.
                `V6Modal` unmounts when closed (see its header — verify-future
                asserts zero [role="dialog"] on an untouched page), so the
                <img> does not exist in the DOM until a reader opens the brief,
                and no request is issued before that. The attribute is the
                second line of defence for the case where a shot sits below the
                fold of an already-open dialog.

                THE CAPTION IS THE HONESTY, NOT A LABEL. A screenshot of
                somebody else's site is a reading that starts aging on
                capture; undated it silently claims to be current. Rendered as
                a real <figure>/<figcaption> pair so the association survives
                for a screen reader, where a sibling <div> would not.

                NO onError FALLBACK, DELIBERATELY. A missing asset must look
                broken: a shot that silently degrades to a placeholder is a
                gate that can never go red, and verify-peers §9 asserts every
                src resolves precisely so this branch is never reached. */}
            {e.shot ? (
              <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <img
                  src={e.shot.src}
                  alt={e.shot.alt}
                  width={1000}
                  height={625}
                  loading="lazy"
                  decoding="async"
                  data-peer-shot={e.id}
                  style={{ display: "block", width: "100%", height: "auto", border: "1px solid var(--rule)", background: "var(--bg-2)" }}
                />
                <figcaption
                  className="mono"
                  style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}
                >
                  captured {e.shot.captured}
                </figcaption>
              </figure>
            ) : null}
            {e.slots.map((s, i) => (
              <div
                key={i}
                style={{
                  border: "1px dashed var(--ink-20)", height: s.h || 120,
                  display: "grid", placeItems: "center",
                  background: "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--text-primary) 1.5%, transparent) 0 10px, color-mix(in srgb, var(--text-primary) 4%, transparent) 10px 20px)",
                }}
              >
                <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>Links</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {e.links.map(([label, href]) =>
              /* p3·16 — a leading "/" means an in-app route, and it routes
                 through react-router rather than a new tab. The convention is
                 not invented here: data.ts's DevLabPulse.href already declares
                 it ("Leading '/' → in-app <Link>; anything else → external
                 anchor"), and this is the second consumer. Without the split
                 the hub cross-link would have shipped as
                 target="_blank" — a full page reload, a new tab the reader
                 did not ask for, and a "↗" glyph promising a site that is
                 this one. Closing the dialog is part of the navigation: a
                 modal left open over the route it just sent you to is the
                 same defect one layer up. */
              href && href.startsWith("/") ? (
                <Link key={label} className="v6-res" to={href} onClick={onClose}>
                  <span className="led" style={{ background: e.c, boxShadow: `0 0 6px ${e.c}` }} />{label} →
                </Link>
              ) : href ? (
                <a key={label} className="v6-res" href={href} target="_blank" rel="noopener noreferrer">
                  <span className="led" style={{ background: e.c, boxShadow: `0 0 6px ${e.c}` }} />{label} ↗
                </a>
              ) : (
                /* Deliberate honest placeholder — these are links the partner
                   hasn't supplied yet, not an oversight. Do not invent URLs. */
                <span key={label} className="v6-res" style={{ borderStyle: "dashed", color: "var(--ink-40)", cursor: "default" }}>
                  {label} · <em style={{ fontStyle: "normal", color: "var(--y-50)" }}>link pending — send it over</em>
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </V6Modal>
  );
}
