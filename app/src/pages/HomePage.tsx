/**
 * pages/HomePage.tsx — Main Home. v6.1.8 rewrite: rotating hero (7 real,
 * sourced passages — see pages/home/passages.ts), a 5-figure live strip, six
 * section cards derived from nav/ia.ts, and a re-sourced thesis block.
 *
 * EAGER — this is the LCP route (App.tsx's own comment). Import nothing heavy
 * at module scope; everything below is already reached by the eager chrome
 * chain (NavTop → nav/ia.ts, ArtBackground → useAnimationClock.ts/prng.ts/
 * useReducedMotion.ts), so this file adds marginal export bodies, not new
 * modules.
 *
 * The hero's right column reserves `#hm-orb` — an EMPTY box. It is not
 * decorative dead space: another surface owns a viewport-fixed canvas that
 * measures this box's rect and lerps into it across the cold-boot Enter
 * handoff. `aspect-ratio: 1/1` reserves the space before that lazy chunk
 * arrives, so removing the box (not just leaving it empty) breaks that
 * handoff's landing target.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";
import { useMoneroLive } from "@/data/DataContext";
import { assertNever, CHAIN_MARKET_CHROME_KEYS, hasData } from "@/data/feed-status";
import { CHROME_LABEL, chromeDetail, useChromeState } from "@/design/useOnline";
import { Card, Crumbs, Pill, Stat, NodeProvenance } from "@/design/primitives";
import { ThemeToggle } from "@/design/ThemeToggle";
import { R } from "../../scripts/routes.mjs";
import { PASSAGES } from "./home/passages";
import { HOME_SECTIONS } from "./home/sections";
import { useHeroRotation } from "./home/useHeroRotation";

/* ── module-level style constants — hoisted so the render loop below
 *    allocates nothing new per row. Per-card COLOR is the one property that
 *    must vary per item; everything else here is shared. ── */

const HERO_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.15fr) minmax(0,0.85fr)",
  gap: 32,
  alignItems: "start",
};
const HERO_LEFT_STYLE: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16, paddingTop: 18, minWidth: 0 };
/** Empty, reserved — see the file header. Rendered by this file; filled by another. */
const ORB_BOX_STYLE: React.CSSProperties = { position: "relative", width: "100%", aspectRatio: "1 / 1", maxHeight: "52vh" };

const ROTATOR_STYLE: React.CSSProperties = { display: "flex", flexDirection: "column" };
/* Zero layout shift across all seven passages, by construction: these two
 * reserves are sized to the longest of the seven finalised strings plus
 * margin, not fitted to any one of them. Verified structurally here; the
 * 0px claim itself is measured by verify-hero.mjs's browser sibling, not by
 * this file — see the return notes. */
const HEADLINE_BOX_STYLE: React.CSSProperties = {
  margin: 0, minHeight: "5.4em", display: "flex", flexDirection: "column", justifyContent: "flex-end",
  fontFamily: "var(--f-serif)", fontSize: "clamp(28px, 3.6vw, 52px)", lineHeight: 1.08, fontWeight: 400,
  letterSpacing: "-0.01em", color: "var(--ink-80)",
};
const LEDE_STYLE: React.CSSProperties = {
  margin: "10px 0 0", minHeight: "5.2em", maxWidth: "56ch", fontSize: "var(--fs-body)", lineHeight: 1.65, color: "var(--ink-60)",
};
const ATTR_ROW_STYLE: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", margin: "10px 0 0" };
const ATTR_WHO_STYLE: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tk-accent)" };
const ATTR_META_STYLE: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)" };
const ATTR_LINK_STYLE: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-60)", textDecoration: "none", borderBottom: "1px solid var(--rule)" };

const DOTS_ROW_STYLE: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, marginTop: 14 };
const DOT_STYLE: React.CSSProperties = { position: "relative", width: 26, height: 3, borderRadius: 2, background: "var(--ink-10)", border: 0, padding: 0, cursor: "pointer", overflow: "hidden" };
const DOT_FILL_STYLE: React.CSSProperties = { position: "absolute", inset: 0, background: "var(--tk-accent)", transformOrigin: "left", transition: "transform 150ms linear" };
const DOT_STATUS_STYLE: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginLeft: 4 };

const CTA_ROW_STYLE: React.CSSProperties = { display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" };
const LINK_RESET: React.CSSProperties = { textDecoration: "none" };
const LEARN_CTA_STYLE: React.CSSProperties = { textDecoration: "none", borderColor: "var(--p-50)", color: "var(--p-50)", boxShadow: "var(--glow-p)" };

const STRIP_GRID_STYLE: React.CSSProperties = { ["--kpi-cols" as unknown as string]: 5, gap: 8, marginTop: 20 };
const PROV_ROW_STYLE: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 };
const PROV_NOTE_STYLE: React.CSSProperties = { fontSize: "var(--fs-label)", color: "var(--ink-20)", marginLeft: 4 };

const CARDS_GRID_STYLE: React.CSSProperties = { ["--kpi-cols" as unknown as string]: 3, gap: 12 };
const CARD_HEAD_STYLE: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const CARD_TITLE_STYLE: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.18em", textTransform: "uppercase" };
const CARD_META_STYLE: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)" };
const CARD_BODY_STYLE: React.CSSProperties = { margin: "8px 0 0", fontFamily: "var(--f-mono)", fontSize: "var(--fs-body)", lineHeight: 1.55, color: "var(--ink-60)" };
const CARD_CTA_STYLE: React.CSSProperties = { display: "block", marginTop: 12, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)" };
const CARD_LINK_STYLE: React.CSSProperties = { textDecoration: "none", color: "inherit", display: "block" };

const THESIS_CARD_STYLE: React.CSSProperties = {
  padding: 28, textAlign: "center",
  background: "color-mix(in srgb, var(--tk-accent) 4%, transparent)",
  borderColor: "color-mix(in srgb, var(--tk-accent) 25%, transparent)",
};
const THESIS_QUOTE_STYLE: React.CSSProperties = { fontFamily: "var(--f-serif)", fontSize: 25, lineHeight: 1.42, color: "var(--ink-100)", margin: "0 auto", maxWidth: "52ch" };
const THESIS_CITE_STYLE: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--tk-accent)", marginTop: 16, display: "block" };

export function HomePage() {
  const data = useMoneroLive();
  const chromeState = useChromeState(data.status, CHAIN_MARKET_CHROME_KEYS);
  const rotation = useHeroRotation(PASSAGES.length);
  const passage = PASSAGES[rotation.index];
  const topBlock = data.blocks[0];

  return (
    <PageShell width="wide" className="home-hero" bg={{ intensity: "busy" }}>

      <Crumbs path={R.HOME} status="Network nominal" />

      {/* Hero */}
      <section style={HERO_GRID_STYLE}>
        <div style={HERO_LEFT_STYLE}>
          <div className="kicker">
            {hasData(data.status.network)
              ? `LIVE · MONERO NETWORK · BLOCK ${data.height.toLocaleString()}`
              : "MONERO NETWORK"}
          </div>

          <div
            style={ROTATOR_STYLE}
            onPointerEnter={rotation.handlers.onPointerEnter}
            onPointerLeave={rotation.handlers.onPointerLeave}
            onFocus={rotation.handlers.onFocus}
            onBlur={rotation.handlers.onBlur}
          >
            {/* id="page-title" — names the <main> landmark (AppShell.tsx). Home
                does not use PageHeader, so it carries the id itself. */}
            <h1
              id="page-title"
              className="serif"
              style={{ ...HEADLINE_BOX_STYLE, opacity: rotation.fading ? 0 : 1, transition: rotation.reduced ? "none" : "opacity 300ms var(--e-standard)" }}
            >
              {passage.lines.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </h1>
            <p className="mono" style={{ ...LEDE_STYLE, opacity: rotation.fading ? 0 : 1, transition: rotation.reduced ? "none" : "opacity 300ms var(--e-standard)" }}>
              {passage.lede}
            </p>
            <div style={{ ...ATTR_ROW_STYLE, opacity: rotation.fading ? 0 : 1, transition: rotation.reduced ? "none" : "opacity 300ms var(--e-standard)" }}>
              <span style={ATTR_WHO_STYLE}>{passage.who}</span>
              <span style={ATTR_META_STYLE}>{passage.meta}</span>
              <Link to={passage.href} style={ATTR_LINK_STYLE}>{passage.where} →</Link>
            </div>
            <div style={DOTS_ROW_STYLE}>
              {PASSAGES.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  style={DOT_STYLE}
                  aria-label={`Passage ${i + 1} of ${PASSAGES.length}: ${p.who}`}
                  aria-current={i === rotation.index ? "true" : undefined}
                  onClick={() => rotation.goTo(i)}
                >
                  <span style={{ ...DOT_FILL_STYLE, transform: `scaleX(${i === rotation.index ? rotation.dwellFrac : 0})` }} />
                </button>
              ))}
              <span style={DOT_STATUS_STYLE}>
                {rotation.reduced
                  ? "auto-advance off (reduced motion)"
                  : rotation.paused
                    ? "paused"
                    : `${rotation.index + 1} / ${PASSAGES.length}`}
              </span>
            </div>
          </div>

          <div style={CTA_ROW_STYLE}>
            <Link to={R.LIVE_MEMPOOL} className="proto-btn" style={LINK_RESET}>Open the mempool →</Link>
            <Link to={R.LEARN} className="proto-btn" style={LEARN_CTA_STYLE}>Learn the protocols</Link>
            <ThemeToggle style={{ marginLeft: 8 }} />
          </div>

          <div className="kpi-grid" style={STRIP_GRID_STYLE}>
            <Stat k="Height" v={hasData(data.status.network) ? data.height.toLocaleString() : "—"} tone="acc" />
            <Stat k="Hashrate" v={hasData(data.status.network) ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"} />
            <Stat k="Mempool" v={hasData(data.status.mempool) ? `${data.mempool.length} tx` : "—"} />
            <Stat k="Block Δ" v={hasData(data.status.blocks) && topBlock ? `${Math.round(topBlock.age)}s` : "—"} />
            <Stat
              k="XMR / USD"
              v={hasData(data.status.market) ? `$${data.price.toFixed(2)}` : "—"}
              tone={hasData(data.status.market) && data.change24h >= 0 ? "g" : undefined}
              sub={hasData(data.status.market) ? `${data.change24h >= 0 ? "▲" : "▼"} ${Math.abs(data.change24h).toFixed(2)}%` : undefined}
            />
          </div>

          <div style={PROV_ROW_STYLE}>
            {(() => {
              // Exhaustive over ChromeState — the FIFTH chrome surface, missed
              // when the other four were converted. It was still collapsing
              // `error` onto CONNECTING, i.e. still telling the lie.
              const title = chromeDetail(chromeState, data.status, CHAIN_MARKET_CHROME_KEYS) ?? undefined;
              switch (chromeState) {
                case "offline": return <Pill dot title={title}>{CHROME_LABEL.offline}</Pill>;
                case "loading": return <Pill title={title}>{CHROME_LABEL.loading}</Pill>;
                case "error": return <Pill tone="warn" dot title={title}>{CHROME_LABEL.error}</Pill>;
                case "stale": return <Pill tone="warn" dot title={title}>{CHROME_LABEL.stale}</Pill>;
                case "live": return <Pill tone="live" dot>SYNCED</Pill>;
                default: return assertNever(chromeState, "HomePage pill");
              }
            })()}
            {/* Two badges, not three: this strip never reads the public node
                CENSUS (`NETWORK` — that is the orb's data), only this site's
                own node cascade and CoinGecko. */}
            <NodeProvenance source="node" keys={["network", "mempool", "blocks"]} status={data.status} />
            <NodeProvenance source="coingecko" keys={["market"]} status={data.status} />
            <span className="mono" style={PROV_NOTE_STYLE}>every figure carries where it came from</span>
          </div>
        </div>

        <div id="hm-orb" className="hm-orb" style={ORB_BOX_STYLE} aria-hidden="true" />
      </section>

      {/* Six section cards — one per nav/ia.ts section, counts derived there */}
      <section>
        <div className="kicker" style={{ marginBottom: 12 }}>The site · 6 sections</div>
        <div className="kpi-grid" style={CARDS_GRID_STYLE}>
          {HOME_SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} style={CARD_LINK_STYLE}>
              <Card style={{ padding: 14, height: "100%" }}>
                <div style={CARD_HEAD_STYLE}>
                  <span style={{ ...CARD_TITLE_STYLE, color: s.color }}>{s.title}</span>
                  <span style={CARD_META_STYLE}>{s.meta}</span>
                </div>
                <p style={CARD_BODY_STYLE}>{s.body}</p>
                <span style={CARD_CTA_STYLE}>{s.cta} →</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Thesis — re-sourced from the site's own bottom-line, honestly attributed */}
      <section>
        <Card style={THESIS_CARD_STYLE}>
          <p className="serif" style={THESIS_QUOTE_STYLE}>
            The surveillance state sees everything. Monero is the one thing they cannot see. That is not a bug — that is the entire point.
          </p>
          <Link to={`${R.MONERO}/bottomline`} style={THESIS_CITE_STYLE}>The bottom line · xmr.irish</Link>
        </Card>
      </section>
    </PageShell>
  );
}
