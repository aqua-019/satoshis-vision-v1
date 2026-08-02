/**
 * pages/markets/MarketsThesisPage.tsx — /live/markets/thesis.
 *
 * A thin route wrapper around the existing `MarketsThesisTab` (previously
 * mounted only as `/monero`'s "Markets · thesis" tab — see monero/tabs.ts).
 * The tab component already renders its own <PageHeader> with
 * `id="page-title"`, so this wrapper supplies ONLY the <PageShell> chrome and
 * a breadcrumb — adding a second <PageHeader> here would put two
 * `#page-title` elements on the route, which verify-nav.mjs §1 asserts never
 * happens.
 *
 * Lazy-loaded from App.tsx with its own chunk (mirrors every other routed
 * page — see App.tsx's header on why), which is what lets
 * verify-bundle.mjs's exactly-one-chunk-per-route mapping hold.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";
import { Crumbs } from "@/design/primitives";
import { useMoneroLive } from "@/data/DataContext";
import { MarketsThesisTab } from "@/pages/monero/MarketsThesisTab";

export function MarketsThesisPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();

  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "live", "markets", "thesis"]} />
      <MarketsThesisTab data={data} navigate={navigate} />
    </PageShell>
  );
}
