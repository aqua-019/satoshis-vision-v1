/**
 * pages/EducationPage.tsx — the Education surface: a 4-tab hub.
 *
 * Routed via /education (Journey, the default) and /education/:tab. The active
 * tab is read from the :tab route param, so every tab is bookmarkable and
 * refresh-safe. Mirrors the /monero + /monero/:tab model. Tabs:
 *   journey    → the BTC → XMR narrative (default)
 *   timeline   → the privacy-evolution timeline
 *   quotes     → the Satoshi quote archive
 *   simulators → the protocol-simulator registry as cards
 *
 * NOTE: the journey / timeline / quotes content is editorial — verify before
 * publishing.
 */

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/layout/AppShell";
import { useMoneroLive } from "@/data/DataContext";
import { Crumbs } from "@/design/primitives";
import { resolveTab } from "./_education/tabs";
import { EduTabs } from "./_education/EduTabs";
import { EduJourney } from "./_education/Journey";
import { EduTimeline } from "./_education/Timeline";
import { EduQuotes } from "./_education/Quotes";
import { EduSimulators } from "./_education/EduSimulators";

export function EducationPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const { tab } = useParams();
  const active = resolveTab(tab);

  // Scroll to top whenever the active tab changes.
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [active]);

  const onChange = (id: string) => navigate(id === "journey" ? "/education" : "/education/" + id);

  let content: React.ReactNode;
  switch (active) {
    case "timeline":   content = <EduTimeline data={data} />; break;
    case "quotes":     content = <EduQuotes />; break;
    case "simulators": content = <EduSimulators navigate={navigate} />; break;
    default:           content = <EduJourney navigate={navigate} />;
  }

  return (
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "20px 48px 80px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1180, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "education", active === "journey" ? "btc → xmr" : active]} status="PRIVACY IS NOT OPTIONAL" />
        <EduTabs active={active} onChange={onChange} />
        {content}
      </div>
    </AppShell>
  );
}
