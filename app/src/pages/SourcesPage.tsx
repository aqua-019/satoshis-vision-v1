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
import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Provenance, NodeProvenance } from "@/design/primitives";
import type { ProvSource } from "@/design/primitives";
import { Swap, SkeletonRows } from "@/design/Skeleton";
import { useReleaseNotes } from "@/data/useCachedFeed";
import { mergeReleases, eraSeamIndex } from "@/data/releases";
import { useApiStatus } from "@/data/useApiStatus";
import { useMoneroLive } from "@/data/DataContext";
import { FEED_KEYS, FEED_ENDPOINT } from "@/data/feed-status";
import { R } from "../../scripts/routes.mjs";

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

/** One row of the five-source legend: the real badge + a one-line gloss + detail. */
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
  /* "The feed answered and produced nothing" — distinct from "unreachable"
     (releaseState === "fail") and from "still loading" (releases === null).
     Computed once here so the header label and the body cannot disagree. */
  const autoEmpty = releases !== null && releases.length === 0;
  /* -1 when the list is single-era, which is exactly the state above: the
     divider is a claim about a discontinuity, so it must not render when
     there is only one era present. */
  const seamAt = eraSeamIndex(mergedReleases);

  // D0891 · configuration (from /api/status) vs. observation (from the live
  // feed this browser has actually been polling). Two different hooks, two
  // different questions — see the new Section below for why they must not be
  // read as one.
  const apiStatus = useApiStatus();
  const data = useMoneroLive();
  const configRows = apiStatus.data
    ? [
        {
          k: "primary node",
          v: apiStatus.data.cascade.primaryConfigured
            ? "configured via env"
            : "not set — falls straight to the reference cascade",
        },
        {
          k: "networks",
          v: (Object.entries(apiStatus.data.cascade.networks) as [string, number][])
            .map(([net, n]) => `${net} ${n}`)
            .join(" · "),
        },
        {
          k: "reference hosts",
          v:
            apiStatus.data.cascade.referenceHosts.length > 0
              ? apiStatus.data.cascade.referenceHosts.join(", ")
              : apiStatus.data.cascade.referenceCount > 0
                ? "operator-configured — not from the public default list, so no hostnames are named here"
                : "none configured",
        },
        {
          k: "endpoints",
          v: apiStatus.data.endpoints.map((e) => `${e.path} (${e.kind})`).join(" · "),
        },
        { k: "note", v: `“${apiStatus.data.note}”` },
        { k: "reported at", v: apiStatus.data.at },
      ]
    : [];
  // Reused verbatim from SourceRow's own row grid (:42) so the two new columns
  // line up with the rest of the page instead of inventing a second rhythm.
  const legendRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    gap: 16,
    padding: "10px 0",
    borderTop: "1px solid var(--rule)",
    alignItems: "start",
  };

  // react-router v6 BrowserRouter does not auto-scroll to #hash on navigation.
  React.useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      <Crumbs path={R.ABOUT_SOURCES} />

      <PageHeader
        kicker="provenance · where every number comes from"
        title='Data &amp; <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">sources</em>'
        sub="Every figure on this site is attributed to exactly one of five sources. This is the legend."
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

      <Section kicker="the five-source legend" title="Where every number comes from">
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

        <SourceRow source="network" gloss="public node population">
          <P>
            A census of the public Monero node population — how many nodes are reachable, and
            which versions and protocol features they advertise — sampled by{" "}
            <b>monero.fail</b>, a third-party node-health tracker. It is read{" "}
            <b>server-side</b>, through a same-origin <code className="hash">/api/nodes</code>{" "}
            proxy: your browser never talks to monero.fail directly, exactly as with every other
            source on this page — CSP here is <code className="hash">connect-src &apos;self&apos;</code>.
          </P>
          <P>
            It reports <b>hosts</b>, not locations: a count of reachable nodes and the software
            they run, never an IP-to-place mapping. This site names no node hosts. NODE, above,
            is different — it is telemetry from the one node cascade this site actually reads;
            NETWORK is a census of the nodes it does not.
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

      <Section kicker="configuration vs. observation · two different questions" title="What this deployment answers">
        <P>
          The two columns below answer different questions, and neither stands in for the other.
          The left column is what this deployment is <b>wired to</b> — env vars and file routes,
          read straight from <code className="hash">/api/status</code> — and it is{" "}
          <b>not a reachability check</b>: that endpoint cannot see whether any node actually
          answers, because on Vercel it runs as its own function with no way to read another
          function&rsquo;s in-memory health state. The right column is what{" "}
          <b>this browser has actually observed</b> this session, live, from the same feed every
          other page on this site reads.
        </P>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24, marginTop: 6 }}>
          <div>
            <h3
              className="mono"
              style={{ margin: "0 0 4px", fontSize: "var(--fs-label)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-60)" }}
            >
              Configured <span className="dim2">· not a reachability check</span>
            </h3>
            <Swap
              ready={apiStatus.status !== "loading"}
              reserve={260}
              skeleton={<SkeletonRows n={6} cols="150px 1fr" />}
            >
              {apiStatus.status === "error" ? (
                <P>
                  <code className="hash">/api/status</code> did not answer with a usable
                  configuration payload just now. That is a fetch failure of this one meta
                  endpoint, not a statement about node health either way.{" "}
                  <button
                    type="button"
                    onClick={apiStatus.retry}
                    className="mono acc"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontSize: "var(--fs-body)" }}
                  >
                    try again
                  </button>
                </P>
              ) : (
                configRows.map((row) => (
                  <div key={row.k} style={legendRow}>
                    <span className="mono dim2" style={{ fontSize: "var(--fs-label)" }}>{row.k}</span>
                    <span className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.6, wordBreak: "break-word" }}>{row.v}</span>
                  </div>
                ))
              )}
            </Swap>
          </div>

          <div>
            <h3
              className="mono"
              style={{ margin: "0 0 4px", fontSize: "var(--fs-label)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-60)" }}
            >
              Observed by your browser <span className="dim2">· this session, live</span>
            </h3>
            {FEED_KEYS.map((k) => (
              <div key={k} style={legendRow}>
                <span className="mono dim2" style={{ fontSize: "var(--fs-label)" }}>{FEED_ENDPOINT[k]}</span>
                <NodeProvenance source={k === "market" ? "coingecko" : "node"} keys={[k]} status={data.status} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <section id="release-notes" style={{ scrollMarginTop: 24 }}>
        <Section
          kicker="active · versioned maintenance"
          title="Release notes"
          // v6.0.4: this label was `whiteSpace: "nowrap"`. Its longest string
          // ("curated list · github unreachable") needs 215px, and at 390px it only
          // gets 136 — so the nowrap pushed the page 34px wide. It buys nothing
          // above 768px, where the label fits on one line anyway.
          // p3·17: this ternary had THREE branches for a FOUR-state feed, and
          // the state the site was ACTUALLY IN fell through the wrong one.
          // MEASURED, not reasoned: `releases` is `ReleaseNote[] | null`, and
          // an EMPTY ARRAY IS TRUTHY — so when the upstream answered
          // successfully with zero parseable entries (every day since July),
          // `releaseState` was "live", the second branch fired, and the header
          // read "github commits · 0 releases" DIRECTLY ABOVE the five curated
          // rows `mergeReleases` rule 4 had just returned. The page
          // contradicted itself in one screenful: it claimed nothing and
          // displayed five things.
          //
          // The missing state is "the feed is alive and produced nothing",
          // which is not "unreachable" and is not "loading". It gets its own
          // branch, and `autoEmpty` is computed once and reused by the body
          // below so the label and the list cannot disagree again.
          right={
            <span className="mono dim2" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.02em" }}>
              {releaseState === "fail"
                ? "curated archive · github unreachable"
                : releases === null
                  ? "fetching github pulls…"
                  : autoEmpty
                    ? "curated archive · no merged pull requests returned"
                    : `github pulls · ${releases.length} releases`}
            </span>
          }
        >
          <p className="mono dim2" style={{ margin: "0 0 4px", fontSize: "var(--fs-label)", lineHeight: 1.6 }}>
            Ordered by ship date, not version number — a point release such as v5.1.0 can land
            between v5.0.9 and v5.0.8, which is expected, not a bug. Recent entries are keyed by
            pull request; older ones by version, from the era when this site still stamped them.
          </p>

          {/* The honest-empty state, per the house vocabulary (`FeedEmpty` in
              pages/future/repoPulse.tsx). Written inline rather than imported,
              and the reason is measured: repoPulse.tsx sits in a chunk whose
              importers are exactly FuturePage and TrustedPeersPage, so importing
              it here adds a third importer group to a route with 429 B of gzip
              margin — the tightest row in verify-bundle's table. Rollup chunks
              per MODULE, so the import would drag RepoPulseReadout in too. The
              shared thing here is a six-line dashed box and a sentence pattern,
              not a fact that can drift; the endpoint and the wording differ. */}
          {autoEmpty ? (
            <div
              className="mono"
              data-release-feed="empty"
              style={{ fontSize: "var(--fs-body)", lineHeight: 1.7, color: "var(--y-50)", border: "1px dashed var(--ink-20)", padding: "10px 12px", margin: "10px 0 4px", overflowWrap: "anywhere" }}
            >
              <code>/api/feeds?src=pulls</code> answered, and returned no merged pull requests —
              so nothing below is automatic. What follows is the curated archive, written by hand.
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {mergedReleases.map((r, i) => (
              <React.Fragment key={r.v}>
              {/* The era seam (§0.6). `mergeReleases` dedupes but does not
                  detect gaps, and the jump from a pull-request id to v5.0.20
                  skips two whole eras — so without this the list reads as if
                  v5.0.20 shipped immediately before the newest PR. Rendered
                  only when BOTH eras are present; see eraSeamIndex. */}
              {i === seamAt ? (
                <div
                  data-release-seam=""
                  className="mono dim2"
                  /* NOT var(--y-50). That is the warning colour `FeedEmpty`
                     uses, and it is right there — an endpoint returned nothing
                     — but this divider is neither data nor a warning, it is
                     editorial annotation like the lede above it. Rendered in
                     the warning colour it was the LOUDEST text in the panel,
                     competing with the `.acc` version ids, which on this site
                     mean crypto data and nothing else. Found by looking at the
                     render; no gate sees colour hierarchy. */
                  style={{ fontSize: "var(--fs-label)", lineHeight: 1.6, padding: "14px 0 10px", borderTop: "1px solid var(--rule)" }}
                >
                  Above: keyed by pull request. Below: keyed by version, ending at v5.0.20. The
                  releases between — the rest of v5.0.x through v6.1.x, and the pull requests that
                  shipped with no version stamp at all — are not listed here.
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 16, padding: "12px 0", borderTop: "1px solid var(--rule)", alignItems: "baseline" }}>
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
              </React.Fragment>
            ))}
          </div>
        </Section>
      </section>
    </PageShell>
  );
}
