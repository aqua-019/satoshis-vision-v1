/**
 * pages/SourcesPage.tsx — "Data & sources": the human-readable provenance legend.
 *
 * This is the plain-language counterpart to the v5.0.19 source-attribution badge
 * (design/provenance.tsx). It explains, in order: what the site is, where every
 * number comes from (NODE / COINGECKO / SESSION / MODEL — the exact badge
 * vocabulary), why the peer panel is paused, and a reverse-chronological release
 * log. The NavTop version label links to the #release-notes section below.
 */

import * as React from "react";
import { useLocation } from "react-router-dom";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Provenance } from "@/design/primitives";
import type { ProvSource } from "@/design/primitives";
import { useReleaseNotes } from "@/data/useCachedFeed";
import { mergeReleases } from "@/data/releases";

// ── small in-page atoms ─────────────────────────────────────────

function Section({ kicker, title, right, children }: { kicker: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div className="kicker">{kicker}</div>
        {right}
      </div>
      <h2 className="serif" style={{ margin: "6px 0 14px", fontSize: 22, fontWeight: 500, color: "var(--ink-100)" }}>{title}</h2>
      {children}
    </Card>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mono dim" style={{ margin: "0 0 10px", fontSize: "var(--fs-body)", lineHeight: 1.7, letterSpacing: "0.01em" }}>{children}</p>;
}

/** One row of the four-source legend: the real badge + a one-line gloss + detail. */
function SourceRow({ source, gloss, children }: { source: ProvSource; gloss: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, padding: "14px 0", borderTop: "1px solid var(--rule)", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Provenance source={source} />
        <span className="mono" style={{ fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.04em" }}>{gloss}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SourcesPage() {
  const { hash } = useLocation();
  const { releases, state: releaseState } = useReleaseNotes(12);
  const mergedReleases = mergeReleases(releases);

  // react-router v6 BrowserRouter does not auto-scroll to #hash on navigation.
  React.useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "32px 48px 56px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1080, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "Data & sources"]} />

        <PageHeader
          kicker="provenance · where every number comes from"
          title='Data &amp; <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">sources</em>'
          sub="Every figure on this site is attributed to exactly one of four sources. This is the legend."
        />

        <Section kicker="read-only · non-custodial" title="What this is">
          <P>
            xmr.irish is a read-only educational tool. It holds no funds, has no accounts, takes no
            custody, and cannot move money. There are no wallets and no sign-ups — nothing to connect.
          </P>
          <P>
            There are no third-party runtime calls. Your browser only ever talks to this origin: all
            live data arrives through same-origin <code className="hash">/api/*</code> proxies, every
            chart is drawn locally with self-hosted Canvas 2D, and there are no trackers, no analytics,
            and no external fonts or scripts.
          </P>
        </Section>

        <Section kicker="the four-source legend" title="Where every number comes from">
          <P>
            This vocabulary matches the badge you see beside data across the site — the badge only says
            where a number came from. It is source attribution, not a &ldquo;fake data&rdquo; warning:
            after the v5.0.14&ndash;v5.0.18 cleanup there is no fabricated data left anywhere.
          </P>

          <SourceRow source="node" gloss="live node telemetry">
            <P>
              Live chain telemetry from a public Monero node cascade — height, hashrate, difficulty,
              mempool, fee tiers, hard-fork version, and per-transaction detail. The cascade tries
              several public nodes in order; if every node fails, the last-good snapshot is held and
              flagged <b className="acc">STALE · reconnecting</b> — never fabricated — while polling
              continues and recovers automatically.
            </P>
          </SourceRow>

          <SourceRow source="coingecko" gloss="live market data">
            <P>
              Live market data — price, 24h change, XMR/BTC, volume, and OHLC candles — proxied and
              cached server-side. If a fetch fails it degrades to the last-good value labelled
              <b> stale</b>, and never to a fabricated fallback.
            </P>
          </SourceRow>

          <SourceRow source="session" gloss="computed in-browser">
            <P>
              Values your browser computes this session from the live data — for example a confirmation
              count is simply the chain tip minus a block&rsquo;s height. Real, but derived locally
              rather than fetched.
            </P>
          </SourceRow>

          <SourceRow source="model" gloss="educational simulator">
            <P>
              The <code className="hash">/simulate</code> simulators: illustrative, metaphor-driven
              animations of how each Monero privacy primitive works. This is the only non-live category
              — educational models, not network data.
            </P>
          </SourceRow>
        </Section>

        <Section kicker="why one panel is empty" title="Peer data">
          <P>
            Peer topology — connection counts, the peer list, and latencies — requires a dedicated
            unrestricted node. The public node cascade this site reads runs restricted RPC: all peer
            fields report <b>0</b>, and <code className="hash">get_connections</code> /
            <code className="hash"> get_peer_list</code> are admin-only.
          </P>
          <P>
            So that panel stays <b>paused</b> rather than showing zeros or invented topology, and it
            will populate the moment a dedicated node is pointed at the site. No peer data is
            fabricated in the meantime.
          </P>
        </Section>

        <section id="release-notes" style={{ scrollMarginTop: 24 }}>
          <Section
            kicker="active · versioned maintenance"
            title="Release notes"
            right={
              <span className="mono dim2" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                {releaseState === "fail"
                  ? "curated list · github unreachable"
                  : releases
                    ? `github commits · ${releases.length} releases`
                    : "fetching github commits…"}
              </span>
            }
          >
            <p className="mono dim2" style={{ margin: "0 0 4px", fontSize: "var(--fs-label)", lineHeight: 1.6 }}>
              Ordered by ship date, not version number — a point release such as v5.1.0 can land
              between v5.0.9 and v5.0.8, which is expected, not a bug.
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {mergedReleases.map((r) => (
                <div key={r.v} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 16, padding: "12px 0", borderTop: "1px solid var(--rule)", alignItems: "baseline" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono acc"
                        style={{ fontSize: "var(--fs-mono)", letterSpacing: "0.04em", color: "inherit", textDecoration: "none" }}
                      >
                        {r.v}
                      </a>
                    ) : (
                      <span className="mono acc" style={{ fontSize: "var(--fs-mono)", letterSpacing: "0.04em" }}>{r.v}</span>
                    )}
                    {r.date ? <span className="mono dim2" style={{ fontSize: "var(--fs-label)" }}>{r.date}</span> : null}
                  </div>
                  <span className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                    {r.note}
                    {r.also ? <span className="mono dim2"> · +{r.also} more commits</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </section>
      </div>
    </AppShell>
  );
}
