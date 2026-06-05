/**
 * pages/MarketsPage.tsx — Phase 1 placeholder.
 *
 * Renders the shared chrome (nav + rail + footer) so the new /markets nav
 * item resolves. The full markets surface (price boards, depth, pairs) lands
 * in a later phase.
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Crumbs } from "@/design/primitives";

export function MarketsPage() {
  return (
    <AppShell bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "markets"]} />
      <PageHeader
        kicker="Markets · live · CG"
        title='Price, depth &amp; pairs — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">soon</em>.'
        sub="The full markets surface lands in a later phase."
      />
    </AppShell>
  );
}
