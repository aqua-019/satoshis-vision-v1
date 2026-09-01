/**
 * pages/future/EcoPopup.tsx — the ecosystem/partner brief dialog.
 *
 * Shared by FuturePage (the stressnet band) and TrustedPeersPage (the `our
 * brief` footer button on each partner card). Lives here rather than beside
 * either page so neither has to import the other — and so TrustedPeersPage
 * never transitively pulls in FutureMini's canvas code.
 *
 * When the entry carries a `url`, the dialog grows a VISIT <NAME> ↗ anchor.
 *
 * p4·M6b — THAT ANCHOR IS NOW THE ONLY WAY OFF-SITE FROM A CARD BODY, and it
 * matters more than it did. A partner card used to `window.open` the partner's
 * site on body click; it opens THIS DIALOG now, so leaving is a second,
 * deliberate click that a reader makes after reading who they are about to
 * visit. See TrustedPeersPage's header for the argument.
 *
 * p4·M6b — THE RESERVATION SLOTS ARE GONE. This body used to render an
 * `e.slots` array as dashed, captioned, empty boxes under the screenshot. A
 * slot with no image in it reads as an image that failed to load, not as an
 * artifact nobody has captured yet — so the type, the field and this markup
 * were deleted together. See EcoShot's header in data.ts for the rule, and
 * verify-peers §11 for the gate that keeps it.
 */

import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

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
  const { pathname } = useLocation();
  const titleId = React.useId();
  const simId = simIdOf(e.simLink);

  /* p4·M6b — CLOSE ONLY WHEN THE READER IS STAYING ON THIS PAGE.
   *
   * THE DEFECT THIS FIXES WAS INTRODUCED BY THE SAME RELEASE, and 39 green
   * gates did not see it. Every in-app destination in this dialog used to run
   * `onClose()` beside its navigation, on the sound rule that "a modal left
   * open over the route it just sent you to is the defect one layer up". That
   * was free while `onClose` was a React state reset. It stopped being free
   * when /operate/peers moved its open-brief state into the URL: `onClose` is
   * now `setPeer("")`, which WRITES HISTORY, so the close raced the navigation
   * and won.
   *
   * Measured on the built branch before this fix — clicking "The Superstress
   * hub · on this site →" inside the Superbrain brief:
   *
   *     before : /operate/peers?p=superbrain
   *     after  : /operate/peers          <- never reached the hub
   *     Back   : /operate/superstress    <- Back goes FORWARD to the destination
   *
   * Two pushes 5.8ms apart, the destination then the page you were already on.
   * The reader followed a link and was returned to where they started.
   *
   * The dialog does not need closing when the destination is a DIFFERENT
   * route: the route change unmounts this dialog's host page and the dialog
   * with it. It DOES need closing for a same-page destination, which is the
   * case the original rule was written for and which no entry uses today —
   * kept because the next in-app link somebody adds may be one. */
  const leaveOpenTo = (dest: string) => {
    try { return new URL(dest, window.location.origin).pathname !== pathname; }
    catch { return false; }
  };
  const closeUnlessLeaving = (dest: string) => { if (!leaveOpenTo(dest)) onClose(); };

  return (
    <V6Modal open={open} onClose={onClose} labelledBy={titleId}>
      {/* p4·M6b — `data-eco-brief` names WHICH entry this dialog is showing.
          /operate/peers?p=<id> is a shareable address now, so a gate has to be
          able to assert that a given slug opened the MATCHING brief rather than
          merely that some dialog appeared. Matching on the rendered title text
          would work today and break on the first copy edit; this cannot. */}
      <div className="v6-modal-head" data-eco-brief={e.id}>
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
        {/* p4·M6b — THE SECOND COLUMN EXISTS TO HOLD THE SCREENSHOT, so an entry
            with no screenshot does not get one. Until this release the right
            column always held something — a shot, or a dashed reservation box —
            so deleting the reservations is what made the empty case reachable,
            which is why the two changes belong in one release.

            AND MY OWN DIAGNOSIS OF IT WAS WRONG, CORRECTED BY MEASURING RATHER
            THAN BY LOOKING AGAIN. Seeing the seventh partner's brief render
            with a wide empty band down its right side, I recorded it as "~40%
            of the dialog is dead space, caused by the reserved second track".
            Measured at 1440 on the shipping build, both states:

              with a shot (xmrclub):  grid 597.8px + 498.2px, paragraph 598px
              without    (kathie):    block, column 1122px,   paragraph 639px

            The paragraph is capped by `max-width: 638.948px` — the HOUSE PROSE
            MEASURE, which p4·07 already measured at 639px across three sibling
            surfaces and recorded as house behaviour rather than a defect. So
            the empty band is the prose cap meeting a fixed-width dialog, and
            it is NOT caused by the grid: removing the track is worth 598 -> 639,
            about 7% of measure, and the band remains.

            KEPT ANYWAY, on the narrower claim it can actually support: a track
            reserved for a thing that does not exist is worth removing, and the
            prose gets its full measure instead of a column's share. What it is
            NOT is a fix for the whitespace, and saying so here costs nothing
            while letting the next reader skip the re-measurement. */}
        {/* p4·M6c — `data-peer-body` IS THE GATE'S HANDLE, and it exists because
            the branch above was gated by NOTHING. A break test removing one
            entry's shot left all 67 assertions green: the column collapsed
            correctly and no assertion in the suite could see either state, so
            this fix could have been reverted in silence. A stable attribute
            rather than a positional selector, on `verify-orb`'s recorded
            ground — a positional one starts passing for the wrong reason the
            moment the markup moves. */}
        <div
          data-peer-body={e.id}
          className={e.shot ? "col-2" : undefined}
          style={e.shot ? { gridTemplateColumns: "1.2fr 1fr", gap: 26 } : undefined}
        >
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
                onClick={() => { const d = `${R.LEARN_SIM}?p=` + simId; closeUnlessLeaving(d); navigate(d); }}
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
                  onClick={() => { const d = e.ctaLink as string; closeUnlessLeaving(d); navigate(d); }}
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
          {e.shot ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* p4·M3 — THE REAL SCREENSHOT.
                Four things here are load-bearing and none is styling:

                `width`/`height` ARE THE INTRINSIC PIXELS, read PER SHOT since
                p4·M6b — they were a hardcoded 1000x625 while every image here
                was a capture at exactly that size, and the first SUPPLIED
                image (1133x879) made the shared constant a per-entry fact. The
                browser reserves the aspect-ratio box before
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

                AND ONLY A CAPTURE IS DATED (p4·M6c). `EcoShot` is a
                discriminated union, so `.captured` exists on the capture arm
                alone and this expression narrows on `kind` before it can read
                one — an undated capture and a dated artwork are both compile
                errors rather than review findings. The artwork caption names
                the source instead, from `e.name`, so it says where the image
                came from without publishing a date nobody here established.

                NO onError FALLBACK, DELIBERATELY. A missing asset must look
                broken: a shot that silently degrades to a placeholder is a
                gate that can never go red, and verify-peers §9 asserts every
                src resolves precisely so this branch is never reached. */}
            {/* p4·M6b — no inner `e.shot ?` here: the COLUMN above is now guarded
                on the same expression, so an inner test could only encode a
                state no entry can produce (wrapper rendered, figure absent).
                It discriminated until this release, because the same div also
                rendered the `slots` reservations and a slots-only entry took
                it legitimately. Deleting the slots and guarding the column in
                one release is what made it dead. */}
            {(
              <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <img
                  src={e.shot.src}
                  alt={e.shot.alt}
                  width={e.shot.w}
                  height={e.shot.h}
                  loading="lazy"
                  decoding="async"
                  data-peer-shot={e.id}
                  style={{ display: "block", width: "100%", height: "auto", border: "1px solid var(--rule)", background: "var(--bg-2)" }}
                />
                <figcaption
                  className="mono"
                  style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}
                >
                  {e.shot.kind === "artwork"
                    ? `artwork · supplied by ${e.name}`
                    : `captured ${e.shot.captured}`}
                </figcaption>
              </figure>
            )}
            </div>
          ) : null}
        </div>

        {/* p4·M6c — GUARDED ON `links.length`, AND THE NINTH PEER IS WHAT
            SURFACED IT. This block rendered its rule and its "Links" heading
            UNCONDITIONALLY, above a map over `e.links`. Every entry that has
            ever shipped carried at least one link, so the empty case had no
            subject and nobody saw it; the ninth peer has none by design,
            because there is nowhere to send a reader yet.

            A captioned empty region is the exact shape p4·M6b deleted the
            screenshot-reservation type for: on a live page it does not read
            as "there are none", it reads as content that FAILED TO RENDER.
            An absent section is the honest form of an absence — the heading
            is a label for something, and with nothing under it the label is
            the lie. */}
        {e.links.length > 0 ? (
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
                <Link key={label} className="v6-res" to={href} onClick={() => closeUnlessLeaving(href)}>
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
        ) : null}
      </div>
    </V6Modal>
  );
}
