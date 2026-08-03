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
import { PageShell } from "@/layout/PageShell";
import { useMoneroLive } from "@/data/DataContext";
import { Crumbs } from "@/design/primitives";
import { EDU_TABS, resolveTab } from "./_education/tabs";
import { EduTabs } from "./_education/EduTabs";
import { EduJourney } from "./_education/Journey";
import { EduTimeline } from "./_education/Timeline";
import { EduQuotes } from "./_education/Quotes";
import { EduSimulators } from "./_education/EduSimulators";
import { R } from "../../scripts/routes.mjs";

export function EducationPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const { tab } = useParams();
  const active = resolveTab(tab);

  // NO scroll handling here. There used to be a `window.scrollTo(0, 0)` keyed
  // on `active`, and above 768px it was a NO-OP on every desktop: `.art` is
  // `height:100vh; overflow:hidden`, so the DOCUMENT never scrolls — `main.main`
  // is the scroller. It only ever did anything below 768px. Tab changes are
  // PATH changes (/education/:tab), so routes/useRouteChrome.ts — called from
  // AppShell, which does see the right element — now resets all three
  // scrollers, on desktop and phone alike.

  const onChange = (id: string) => navigate(id === "journey" ? R.LEARN : `${R.LEARN}/${id}`);

  let content: React.ReactNode;
  switch (active) {
    case "timeline":   content = <EduTimeline data={data} />; break;
    case "quotes":     content = <EduQuotes />; break;
    case "simulators": content = <EduSimulators navigate={navigate} />; break;
    default:           content = <EduJourney navigate={navigate} />;
  }

  return (
    <PageShell width="reading" bg={{ intensity: "calm" }}>
      <Crumbs
        path={active === "journey" ? R.LEARN : `${R.LEARN}/${active}`}
        tail={EDU_TABS.find((t) => t.id === active)?.label ?? active}
        status="PRIVACY IS NOT OPTIONAL"
      />
      <EduTabs active={active} onChange={onChange} />
      {content}
    </PageShell>
  );
}
