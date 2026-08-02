/**
 * pages/future/OutlookPage.tsx — /future/outlook.
 *
 * A thin route wrapper around the existing `OutlookTab` (previously mounted
 * only as `/monero`'s "2027+ Outlook" tab — see monero/tabs.ts). The tab
 * component already renders its own <PageHeader> with `id="page-title"`, so
 * this wrapper supplies ONLY the <PageShell> chrome and a breadcrumb —
 * adding a second <PageHeader> here would put two `#page-title` elements on
 * the route, which verify-nav.mjs §1 asserts never happens.
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
import { OutlookTab } from "@/pages/monero/OutlookTab";

export function OutlookPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();

  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "future", "outlook"]} />
      <OutlookTab data={data} navigate={navigate} />
    </PageShell>
  );
}
