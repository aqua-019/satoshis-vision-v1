/**
 * pages/network/NodePopulationPanel.tsx — "The network · public node population".
 *
 * Renders `useNodePopulation()` (@/data/useNodePopulation — the authority; read,
 * not modified, by this file). That hook proxies monero.fail's public node
 * census through the same-origin `/api/nodes` function: how many public Monero
 * nodes are reachable, their clear/Tor/I2P transport split, an availability-
 * ratio histogram, and chain-height agreement/lag clustering.
 *
 * ── NODE vs NETWORK, restated (design/provenance.tsx owns the vocabulary) ───
 * Every other panel on this page reads NODE — telemetry from the one Monero
 * node this site's own RPC cascade talks to. This panel reads NETWORK — a
 * census, sampled by a third party, of nodes this site does NOT talk to. The
 * two must never be conflated, which is why this panel carries its own
 * `NodeProvenance source="network"` badge rather than reusing NetworkPage's
 * `DataPanel` (that helper is wired to the polled NODE feed's `FeedStatusMap`
 * and has no member for this endpoint).
 *
 * ── HARD RULE: height.mode is NEVER compared against this page's own live
 * chain height (data.height from useMoneroLive) ──────────────────────────────
 * `/api/nodes` caches at the edge with `s-maxage=300` (api/nodes.js) — a
 * five-minute-old snapshot on a chain that produces a block roughly every two
 * minutes. Diffing a 5-minute-stale census mode against this second's live tip
 * would manufacture a false "everyone is lagging" story on every page load,
 * not a real one. `sampledAt`, rendered verbatim below, is the honest
 * disclosure instead: it says exactly how old the census is and lets the
 * reader do their own arithmetic, rather than this component doing bad
 * arithmetic on their behalf.
 *
 * ── DELIBERATELY ABSENT: any map, globe, or coordinate ───────────────────────
 * monero.fail reports HOSTS, not locations (see SourcesPage.tsx's NETWORK
 * legend row) — this site has no IP-to-place mapping for any node, its own or
 * anyone else's, and invents none. The only spatial object below is the
 * clear/Tor/I2P proportion bar, and a 1-D bar is structurally incapable of
 * claiming a geography it was never given: there is no axis on it a location
 * could be plotted against. That is a property of the representation, not a
 * promise about future restraint.
 *
 * ── LIFTED FROM, NOT COPIED FROM, docs/v6-mockups/coldboot-splash.html:520-551
 * The readout STRUCTURE (reachable/split/agreement/lagging/availability/
 * sampled) is real and lifted from that mockup's `.net-rows`. Its numbers are
 * design fiction and are not reused. Its "Propagation · stem 4 · fluff 12" row
 * is EXCLUDED — the mockup's own `net-src` legend labels that row
 * "Illustrative — not observable from a node", and this component draws only
 * from fields the wire contract in useNodePopulation.ts actually declares.
 *
 * ── data-aux-key, not data-panel-key ─────────────────────────────────────────
 * verify-failure.mjs kills ONE endpoint at a time and asserts that degrades
 * exactly the panels fed by it. This panel reads a wholly different endpoint
 * (`/api/nodes`, not any member of the polled `FeedKey` union) — a
 * `data-panel-key="nodes"` would enter that survey and read as "degraded" the
 * moment an unrelated, unmocked fetch fails, for an endpoint the survey never
 * touched. `data-aux-key="nodes"` on the wrapper below is a plain marker for a
 * later DOM gate, with no failure-survey semantics attached — the same choice
 * NetworkPage's existing paused peer panel already makes ("No dataKey,
 * deliberately").
 *
 * ── NODE_PANEL_H: computed, not measured — say so plainly ───────────────────
 * Every row below uses an EXPLICIT height/lineHeight rather than organic text
 * flow, specifically to avoid the failure mode NetworkPage.tsx:309-328 records
 * for POOL_ATTR_H: a formula (52) that undershot the real loading-state render
 * (61) because organic line-height shifts with which font has loaded. Fixed
 * heights make the three states' contribution to layout arithmetic rather than
 * measurement — but "computed correctly" and "confirmed in a real engine" are
 * different claims, and only the second is a fact. This sandbox could not
 * install Chromium to check the second one (`npx playwright install chromium`
 * → HTTP 403 "host not permitted" through the outbound proxy — the same class
 * of egress block this repo's own Session Notes record for monero.fail and
 * api.coingecko.com). Confirm on a live preview before trusting this number;
 * bump it and update the arithmetic comment below together if it drifts.
 */

import * as React from "react";
import { PanelFrame, NodeProvenance, MiniBar } from "@/design/primitives";
import { Swap, SkeletonRows } from "@/design/Skeleton";
import { useNodePopulation, heightAgreementPct } from "@/data/useNodePopulation";
import { usePendingDelay } from "@/design/usePendingDelay";

/* ── fixed-height budget — see the docblock's NODE_PANEL_H note ────────────
   Every number below is a DECLARED box height (React `height`, not
   `minHeight`), not a measurement of rendered text, so the sum is exact by
   construction rather than approximate. */
const ROW_H = 20;       // one mono label/value line (--fs-mono, ≤14px, lh 20px)
const DETAIL_H = 18;    // one --fs-label (≤12px) detail line, lh 18px
const CAPTION_H = 36;   // two --fs-label lines, lh 18px — the worst-case wrap
                        // width for the transport-split caption at 390px (see
                        // arithmetic below); wider viewports render one line
                        // into the same reserved box, never a taller one.
const BAR_H = 14;       // proportion-bar track — matches NetworkPage.tsx:598's
                        // existing height:14 idiom exactly.
const MINIBAR_H = 36;   // MiniBar's own default `height` prop. Deterministic
                        // ONLY because MiniBar's default `width` (220) is
                        // capped via CSS maxWidth and this panel's narrowest
                        // real container (390px viewport − .main's 14px×2
                        // gutter − .panel-b's 12px×2 padding ≈ 342px) is
                        // always wider than 220 — so the SVG never falls back
                        // to aspect-ratio scaling against a container edge.
const GAP_ROW = 14;     // vertical gap between the six row-blocks
const GAP_SM = 8;        // gap between a row-block's own sub-parts
const GAP_TIGHT = 6;    // gap between a headline and its own detail line

/*  row 1  Reachable nodes                                    ROW_H       = 20
    gap                                                       GAP_ROW     = 14
    row 2  value + gap + bar + gap + caption      20+8+14+8+36            = 86
    gap                                                       GAP_ROW     = 14
    row 3  headline + gap + detail                       20+6+18         = 44
    gap                                                       GAP_ROW     = 14
    row 4  headline + gap + detail (always rendered,
           "—" when lagging.count === 0, so this row's
           height cannot change on a background refresh)      20+6+18     = 44
    gap                                                       GAP_ROW     = 14
    row 5  label + gap + MiniBar                          20+8+36        = 64
    gap                                                       GAP_ROW     = 14
    row 6  Sampled                                             ROW_H       = 20
    ───────────────────────────────────────────────────────────────────────
    total                                                                 = 348  */
const NODE_PANEL_H = 348;

function Row({ label, value, valueColor }: { label: React.ReactNode; value: React.ReactNode; valueColor?: string }) {
  return (
    <div
      className="mono"
      style={{
        display: "grid", gridTemplateColumns: "1fr auto", alignItems: "baseline", gap: 10,
        fontSize: "var(--fs-mono)", fontVariantNumeric: "tabular-nums",
        height: ROW_H, lineHeight: ROW_H + "px",
      }}
    >
      <span className="dim">{label}</span>
      <span style={{ color: valueColor ?? "var(--ink-100)", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Detail({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mono dim2"
      style={{ margin: 0, fontSize: "var(--fs-label)", lineHeight: DETAIL_H + "px", height: DETAIL_H, overflow: "hidden" }}
    >
      {children}
    </p>
  );
}

/** clear/tor/i2p percentages against `split.total` — 0 when the sample is empty,
 *  never NaN (the divide is guarded, not just the display). */
function splitPct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}

export function NodePopulationPanel() {
  const { data, status, at, refreshing: rawRefreshing, retry } = useNodePopulation();
  const refreshing = usePendingDelay(rawRefreshing);

  const isUnavailable = data != null && data.status === "unavailable";
  const isHardError = status === "error" && data === null;
  const ok = data != null && (data.status === "live" || data.status === "stale");

  let body: React.ReactNode = null;

  if (isHardError) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="mono" style={{ fontSize: 26, color: "var(--ink-60)" }}>—</span>
          <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>
            <code className="hash">/api/nodes</code> did not answer
          </span>
        </div>
        <p className="mono dim" style={{ fontSize: "var(--fs-body)", margin: 0, lineHeight: 1.5, color: "var(--ink-40)" }}>
          A fetch failure of this site's own node-population proxy — not a claim about monero.fail either
          way, which this browser never reached.{" "}
          <button
            type="button"
            onClick={retry}
            className="mono acc"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontSize: "var(--fs-body)" }}
          >
            try again
          </button>
        </p>
      </div>
    );
  } else if (isUnavailable && data && data.status === "unavailable") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="mono" style={{ fontSize: 26, color: "var(--ink-60)" }}>—</span>
          <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>
            <b>monero.fail</b> did not answer
          </span>
        </div>
        <p className="mono dim" style={{ fontSize: "var(--fs-body)", margin: 0, lineHeight: 1.5, color: "var(--ink-40)" }}>
          This site's <code className="hash">/api/nodes</code> proxy answered, and reports the upstream
          census itself failed — reason <b className="acc">{data.reason}</b>
          {data.upstreamStatus != null ? <> (HTTP {data.upstreamStatus})</> : null}.{" "}
          <button
            type="button"
            onClick={retry}
            className="mono acc"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontSize: "var(--fs-body)" }}
          >
            try again
          </button>
        </p>
      </div>
    );
  } else if (ok && data && (data.status === "live" || data.status === "stale")) {
    const { counts, split, availability, height, sampledAt } = data;

    const clearPct = splitPct(split.clear, split.total);
    const torPct = splitPct(split.tor, split.total);
    const i2pPct = splitPct(split.i2p, split.total);

    // Shared with the cold-boot console via the one implementation in
    // @/data/useNodePopulation — both surfaces render this statistic under the
    // same label, so it cannot be allowed to exist twice.
    const heightSample = height.clusters.reduce((a, c) => a + c.count, 0);
    const agreementPct = heightAgreementPct(height);

    const lagCount = height.lagging.count;
    const lagClusters = height.lagging.clusters;
    const worstLag = lagClusters.length ? Math.max(...lagClusters.map((c) => Math.abs(c.lag))) : null;

    const availLabels = availability.map((b) => `${Math.round(b.from * 100)}–${Math.round(b.to * 100)}%`);

    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: GAP_ROW }}>
        {/* 1 · Reachable nodes */}
        <Row
          label="Reachable nodes"
          value={`${counts.reachable.toLocaleString()} of ${counts.seen.toLocaleString()}`}
        />

        {/* 2 · clear / tor / i2p + 3-segment proportion bar. The bar is the
            ONLY spatial object this panel draws — a 1-D proportion, not a map;
            see the docblock's "deliberately absent" note. */}
        <div style={{ display: "flex", flexDirection: "column", gap: GAP_SM }}>
          <Row
            label="clear / tor / i2p"
            value={`${split.clear.toLocaleString()} / ${split.tor.toLocaleString()} / ${split.i2p.toLocaleString()}`}
          />
          <div style={{ height: BAR_H, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
            {split.total > 0 ? (
              <>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: "0%", width: clearPct + "%", background: "var(--tk-accent)", opacity: 0.85, boxShadow: "0 0 6px var(--tk-accent)" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: clearPct + "%", width: torPct + "%", background: "var(--p-50)", opacity: 0.85, boxShadow: "0 0 6px var(--p-50)" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: (clearPct + torPct) + "%", width: i2pPct + "%", background: "var(--c-50)", opacity: 0.85, boxShadow: "0 0 6px var(--c-50)" }} />
              </>
            ) : null}
          </div>
          <p className="mono dim2" style={{ margin: 0, fontSize: "var(--fs-label)", lineHeight: (CAPTION_H / 2) + "px", height: CAPTION_H, overflow: "hidden" }}>
            Tor and I2P have no location — monero.fail returns hosts, not coordinates.
          </p>
        </div>

        {/* 3 · Height agreement */}
        <div style={{ display: "flex", flexDirection: "column", gap: GAP_TIGHT }}>
          <Row
            label="Height agreement"
            value={agreementPct != null ? `${agreementPct.toFixed(1)}%` : "—"}
          />
          <Detail>
            {height.mode != null ? `mode ${height.mode.toLocaleString()}` : "mode —"} · n={heightSample.toLocaleString()}
          </Detail>
        </div>

        {/* 4 · Lagging set — always renders both lines, so a background
            refresh that moves lagging.count off zero cannot change this
            row's height. */}
        <div style={{ display: "flex", flexDirection: "column", gap: GAP_TIGHT }}>
          <Row
            label="Lagging set"
            value={lagCount > 0 ? `${lagCount.toLocaleString()} node${lagCount === 1 ? "" : "s"} > 2 behind` : "—"}
            valueColor={lagCount > 0 ? "var(--y-50)" : "var(--ink-40)"}
          />
          <Detail>
            {lagCount > 0
              ? `across ${lagClusters.length.toLocaleString()} cluster${lagClusters.length === 1 ? "" : "s"} · worst ${worstLag} block${worstLag === 1 ? "" : "s"} behind`
              : "—"}
          </Detail>
        </div>

        {/* 5 · Availability · rolling checks */}
        <div style={{ display: "flex", flexDirection: "column", gap: GAP_SM }}>
          <div className="mono dim" style={{ fontSize: "var(--fs-mono)", height: ROW_H, lineHeight: ROW_H + "px" }}>
            Availability · rolling checks
          </div>
          <MiniBar data={availability.map((b) => b.count)} labels={availLabels} hover />
        </div>

        {/* 6 · Sampled — the server instant, verbatim. Never a ticking
            relative age: see the docblock's HARD RULE note. */}
        <Row label="Sampled" value={sampledAt ? sampledAt.slice(11, 19) + " UTC" : "—"} />
      </div>
    );
  }

  return (
    <div data-aux-key="nodes">
      <PanelFrame
        title="The network · public node population"
        right={<NodeProvenance source="network" phase={status} detail="monero.fail" />}
        updatedAt={at}
        refreshing={refreshing}
      >
        <Swap
          ready={status !== "loading"}
          reserve={NODE_PANEL_H}
          skeleton={<SkeletonRows n={6} cols="1fr auto" rowH={ROW_H} gap={GAP_ROW} />}
        >
          {body}
        </Swap>
      </PanelFrame>
    </div>
  );
}
