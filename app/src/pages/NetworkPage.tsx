/**
 * pages/NetworkPage.tsx — Phase 1 placeholder.
 *
 * Renders the shared chrome (nav + rail + footer) so the new /network nav
 * item resolves. The full network surface (peers, nodes, propagation, fork
 * readiness) lands in a later phase.
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Crumbs } from "@/design/primitives";

export function NetworkPage() {
  return (
    <AppShell bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "network"]} />
      <PageHeader
        kicker="Network · live"
        title='Peers, nodes &amp; propagation — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">soon</em>.'
        sub="The full network surface lands in a later phase."
      />
    </AppShell>
  );
}
