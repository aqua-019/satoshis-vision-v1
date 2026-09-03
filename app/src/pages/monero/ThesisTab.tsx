/**
 * pages/monero/ThesisTab.tsx — /monero/thesis, the eighth tab.
 *
 * Seven pressures on Monero demand, each sourced to a named publication with
 * its own date, each openable as a full brief, and a closing box that reads
 * the seven together. Ported from the operator-approved mockup
 * `p4-M11-thesis-MOCKUP.html`; the content lives in `thesisData.ts`, which is
 * generated from that file rather than retyped (see its header).
 *
 * THIS TAB IS THE ONLY LAZY ONE, AND THAT IS MEASURED RATHER THAN PREFERRED.
 * `MoneroPage` mounts exactly ONE tab, and on the base measured for p4·M11
 * `/monero` had **1,138 B** of gzip margin (113,862 of 115,000 — the 7th
 * tightest of the eighteen route rows, not the roomiest) while this tab's
 * data alone is ~13.3 kB gzip. A static import would make all seven other
 * tabs pay for prose they never render, which is the defect p4·M3 recorded
 * against `pages/future/data.ts` and declined to fix only because another PR
 * owned the file. `views/index.tsx` makes the identical argument for the ten
 * mempool view engines, and `verify-bundle.mjs:2288` records that a route's
 * closure EXCLUDES dynamicImports for exactly that reason — so this is the
 * repo's established shape for "one page, N alternative panes", not a new one.
 *
 * FOUR DEVIATIONS FROM THE MOCKUP, all resolved toward the repo and all
 * recorded here because the mockup is otherwise the spec:
 *
 *  1. NO WEBFONT LINK. The mockup loads Google Fonts; this site self-hosts 12
 *     woff2 and gates third-party browser requests at zero. `--f-disp` /
 *     `--f-mono` / `--f-body` already resolve to the same three families.
 *  2. NO REDECLARED TOKENS. The mockup's `:root` restates `--bg-0..3`,
 *     `--rule` and `--ink-100/60/40/20` with its own (cooler) values. Those
 *     names are the repo's, so the block is deleted outright rather than
 *     mapped — the page then inherits the site palette in all three themes.
 *  3. NO 9.5px TYPE. `.th-chip`, `.th-ours b`, `.th-corr-h`, `.th-corr-shared`
 *     and `.th-tag` declare 9.5px in the mockup. They take `var(--fs-label)`,
 *     which is clamp(11px, .74vw, 12px) and 12px below 720. Fixed with the
 *     TOKEN, never with a `:not()` bolted onto an existing selector.
 *  4. NO `document.body` CLASS. The mockup traces a theme by toggling
 *     `body.lit` and reaching out with `document.querySelectorAll`. Here the
 *     lit theme is component state on this tab's own root (`data-lit`), so
 *     nothing outside this subtree can be styled by it and nothing has to be
 *     cleaned up on unmount.
 *
 * dangerouslySetInnerHTML IS USED AND IT IS SAFE HERE, said out loud because
 * the sink deserves it: every string it receives is a compile-time literal
 * from `thesisData.ts`. Nothing is URL-derived — `resolveTab` validates the
 * tab id against a fixed list before this module is reached — nothing is
 * user-supplied, and no template interpolates a variable into the markup.
 * `verify-thesis.mjs` §6 asserts that last property against the source, so it
 * cannot quietly stop being true.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { V6Modal } from "@/pages/future/V6Modal";
import type { MoneroTabProps } from "./tabs";
import {
  THESIS_PRESSURES,
  THESIS_SOURCES,
  THESIS_THEMES,
  THESIS_THEME_HUE,
  THESIS_ORDER,
  THESIS_WHY,
  hueOf,
  pairKey,
  type ThesisPressure,
  type ThesisThemeId,
} from "./thesisData";

/** Author-constant HTML from thesisData.ts. See the file header. */
function Html({ html, className, tag }: { html: string; className?: string; tag?: "div" | "p" | "span" }) {
  const T = tag ?? "div";
  return <T className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The other pressures this one shares a theme with, most-shared first, then
 *  in argument order. Same derivation as the mockup's corrBlock(). */
function related(p: ThesisPressure) {
  return THESIS_PRESSURES.filter((o) => o.id !== p.id)
    .map((o) => ({ o, shared: o.themes.filter((t) => p.themes.includes(t)) }))
    .filter((x) => x.shared.length > 0)
    .sort(
      (a, b) =>
        b.shared.length - a.shared.length ||
        THESIS_ORDER.indexOf(a.o.numeral) - THESIS_ORDER.indexOf(b.o.numeral),
    );
}

function Chips({ themes, lit }: { themes: readonly ThesisThemeId[]; lit: ThesisThemeId | null }) {
  return (
    <ul className="th-chips">
      {themes.map((t) => (
        <li
          key={t}
          className={"th-chip" + (lit && t === lit ? " is-on" : "")}
          style={{ ["--tc" as string]: `var(${THESIS_THEME_HUE[t]})` }}
        >
          {THESIS_THEMES[t]}
        </li>
      ))}
    </ul>
  );
}

function Brief({ p, titleId, onClose }: { p: ThesisPressure; titleId: string; onClose: () => void }) {
  const rel = related(p);
  return (
    <>
      <div className="th-num" style={{ color: `var(${p.hue})` }}>
        {p.num}
      </div>
      <div className="th-kicker">{p.kicker}</div>
      <h2 id={titleId} className="th-brief-title">
        {p.title}
      </h2>
      <p className="th-lede">{p.lede}</p>

      {p.secs.map((s) => (
        <React.Fragment key={s.h}>
          <h3 className="th-h">{s.h}</h3>
          {s.t ? <Html html={s.t} /> : null}
          {s.dl ? (
            <dl className="th-dl">
              {s.dl.map(([term, desc]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <Html tag="div" html={desc} className="th-dd" />
                </div>
              ))}
            </dl>
          ) : null}
        </React.Fragment>
      ))}

      {rel.length > 0 ? (
        <div className="th-corr">
          <p className="th-corr-h">Where this overlaps — {rel.length} of the other six</p>
          <ul className="th-corr-themes">
            {p.themes.map((t) => (
              <li key={t} style={{ ["--ct" as string]: `var(${THESIS_THEME_HUE[t]})` }}>
                {THESIS_THEMES[t]}
              </li>
            ))}
          </ul>
          <ul className="th-corr-list">
            {rel.map(({ o, shared }) => (
              <li key={o.id}>
                <span className="th-corr-n" style={{ ["--cn" as string]: `var(${hueOf(o.numeral)})` }}>
                  {o.numeral}
                </span>
                <span>
                  <b>{o.title.replace(/&amp;/g, "&")}</b> —{" "}
                  {THESIS_WHY[pairKey(p.numeral, o.numeral)] ??
                    `Shares ${shared.map((t) => THESIS_THEMES[t]).join(" and ")}.`}{" "}
                  <span className="th-corr-shared">
                    shared: {shared.map((t) => THESIS_THEMES[t]).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3 className="th-h">Sources — every one a link</h3>
      {p.srcs.length > 0 ? (
        <ul className="th-srcs">
          {p.srcs.map((k, i) => {
            const s = THESIS_SOURCES[k];
            return (
              <li key={k}>
                <span className="th-srcs-n">{i + 1}</span>
                <span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </span>
                <span className="th-srcs-d">{s.date}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>This panel is argument, not data. It cites nothing because it claims nothing measurable.</p>
      )}

      <button type="button" className="th-brief-x" onClick={onClose}>
        CLOSE ✕
      </button>
    </>
  );
}

export function ThesisTab(_props: MoneroTabProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  // useId, not a hardcoded string — the idiom both existing V6Modal consumers
  // use (EcoPopup, ProtoPopup). A literal id is one duplicated mount away from
  // two dialogs sharing an aria-labelledby target.
  const titleId = React.useId();
  const [lit, setLit] = React.useState<ThesisThemeId | null>(null);
  const open = THESIS_PRESSURES.find((p) => p.id === openId) ?? null;

  return (
    <div className="th-root" data-lit={lit ?? undefined}>
      <PageHeader
        kicker="Demand drivers · as of September 2026"
        title='Seven pressures, <em style="font-style:italic;color:var(--ink-60)">and one of them is a prison sentence.</em>'
      />
      <p className="th-standfirst">
        Every figure is quoted from a named source, dated where its publisher dates it — two of
        the sources here are standing pages with no publication date and say so rather than
        carrying an invented one. Every source is a link you can open. Where the argument is ours
        rather than a source&rsquo;s, it says so. Open any panel for the full brief — a thesis you
        cannot check is a slogan.
      </p>

      <div className="th-loop">
        {/* The flow overlay. PORTED VERBATIM from the mockup's own path data and
            then MEASURED — see verify-thesis.mjs §7, which reads every arrow
            endpoint back against the rendered panel rects rather than trusting
            that a hand-placed coordinate still lands after a font change. It is
            decorative: `aria-hidden`, pointer-events:none, and hidden below
            881px exactly as the mockup hides it. */}
        <svg className="th-loop-svg" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="th-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,1 L9,5 L0,9 z" fill="var(--ink-40)" />
            </marker>
          </defs>
          <g fill="none" stroke="var(--ink-40)" strokeWidth="1.2" markerEnd="url(#th-ah)">
            {["M300,70 C420,70 480,70 560,70",
              "M118,150 C118,200 118,220 118,258",
              "M300,325 C360,325 380,325 418,325",
              "M762,212 C762,268 700,298 640,314",
              "M148,416 C148,446 158,456 198,464",
              "M520,416 C520,446 510,456 470,464",
              "M250,606 C250,632 250,640 250,658",
              "M500,700 C560,700 580,700 618,700"].map((d) => (
                <path key={d} className="th-flow" d={d} />
              ))}
          </g>
          <path d="M958,658 C990,560 990,138 350,58" fill="none" stroke="var(--ink-40)" strokeWidth="1.2"
                strokeDasharray="2 6" markerEnd="url(#th-ah)" opacity=".65" />
        </svg>

        <div className="th-grid">
          {THESIS_PRESSURES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                "th-panel" +
                (p.id === "p2" ? " th-panel--hinge" : "") +
                (lit ? (p.themes.includes(lit) ? " is-on" : "") : "")
              }
              style={{ ["--ga" as string]: p.id, ["--hue" as string]: `var(${p.hue})` }}
              data-thesis-panel={p.id}
              onClick={() => setOpenId(p.id)}
              aria-label={`${p.numeral} — ${p.title}. Open the full brief.`}
            >
              <div className="th-num">{p.num}</div>
              <div className="th-kicker">{p.kicker}</div>
              <h2 className="th-title">{p.title.replace(/&amp;/g, "&")}</h2>
              {p.cardHTML ? (
                <Html className="th-body" html={p.cardHTML} />
              ) : (
                <Html tag="p" className="th-body" html={p.card ?? ""} />
              )}
              <ul className="th-figs">
                {p.figs.map(([v, l]) => (
                  <li key={v + l} className="th-fig">
                    {v} <i>{l}</i>
                  </li>
                ))}
              </ul>
              <Chips themes={p.themes} lit={lit} />
              {p.ours ? (
                <div className="th-ours">
                  <b>{p.oursLabel}</b>
                  <Html tag="span" html={p.ours} />
                </div>
              ) : null}
              <div className="th-foot">
                <span className="th-src">{p.srcline}</span>
                <span className="th-more">full brief →</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="th-key">
        <span className="th-key-lab">Shared themes — tap to trace</span>
        {(Object.keys(THESIS_THEMES) as ThesisThemeId[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={lit === t}
            style={{ ["--tc" as string]: `var(${THESIS_THEME_HUE[t]})` }}
            onClick={() => setLit((cur) => (cur === t ? null : t))}
          >
            {THESIS_THEMES[t]} <span>{THESIS_PRESSURES.filter((p) => p.themes.includes(t)).length}</span>
          </button>
        ))}
      </div>

      <div className="th-legend">
        <span><i /> supports / drives</span>
        <span><i className="th-legend-d" /> the loop closes — VII returns to I</span>
        <span>II is drawn largest because it is the hinge</span>
      </div>

      <section className="th-answer">
        <div className="th-answer-in">
          <div className="th-answer-eyebrow">Seven pressures · one answer</div>
          <h2 className="th-answer-h">
            Every one of these has the same <em>escape valve</em>.
          </h2>
          <p className="th-answer-lede">
            Read the seven together and they stop being a list of worries. They are seven
            independent forces — legal, physical, commercial, criminal, geopolitical, technical —
            converging on a single requirement: <strong>money whose record is never written.</strong>{" "}
            There is exactly one widely-used asset that satisfies it.
          </p>

          <div className="th-ans-grid">
            {THESIS_PRESSURES.map((p) => (
              <div
                key={p.id}
                className={"th-ans-cell" + (p.id === "p7" ? " th-ans-cell--wide" : "")}
                style={{ ["--ac" as string]: `var(${p.hue})` }}
              >
                <div className="th-ans-n">{p.ans[0]}</div>
                <p className="th-ans-q">{p.ans[1]}</p>
                <Html tag="p" className="th-ans-a" html={p.ans[2]} />
              </div>
            ))}
          </div>

          <p className="th-answer-kicker">
            Stablecoins can be frozen because the law requires the switch to exist. Bitcoin privacy
            can be prosecuted because the service has an owner.{" "}
            <b>Monero has neither switch nor owner — because the protocol never built one.</b>
          </p>

          <p className="th-answer-note">
            This box is argument, not measurement. Every figure above it is sourced and linked.
          </p>
        </div>
      </section>

      <V6Modal
        open={open !== null}
        onClose={() => setOpenId(null)}
        labelledBy={titleId}
        variant="thesis"
      >
        {open ? (
          <div className="th-brief" style={{ ["--hue" as string]: `var(${open.hue})` }}>
            <Brief p={open} titleId={titleId} onClose={() => setOpenId(null)} />
          </div>
        ) : null}
      </V6Modal>
    </div>
  );
}
