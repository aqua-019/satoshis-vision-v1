/**
 * pages/DesignPage.tsx — Phase 1 placeholder.
 *
 * Backs the top-right "⌘ DESIGN" affordance in the top bar so the link
 * resolves instead of 404-ing. The legacy design-hub review canvas is NOT
 * ported here; the full internal review surface lands in a later phase.
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Crumbs } from "@/design/primitives";

export function DesignPage() {
  return (
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "design hub"]} status="Internal · review surface" />
      <PageHeader
        kicker="Design hub · internal"
        title='Five mempool directions, side by side — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">soon</em>.'
        sub="The full internal review surface lands in a later phase."
      />
    </AppShell>
  );
}
