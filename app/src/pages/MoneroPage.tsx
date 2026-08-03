/**
 * pages/MoneroPage.tsx — the Monero surface: a tabbed section.
 *
 * Routed via /monero (overview) and /monero/:tab. The active tab is read from
 * the :tab route param, so every tab is bookmarkable and refresh-safe. The
 * breadcrumb's last segment reflects the active tab; the tab bar sits beneath
 * it with an orange active underline. Mirrors five01's /monero/<id> model.
 *
 * v6.1.6: two former tabs — "Markets · thesis" and "2027+ Outlook" — moved to
 * their own top-level pages (/live/markets/thesis, /future/outlook; see
 * monero/tabs.ts's header). #markets-thesis and #outlook are handled here as
 * CLIENT-ONLY redirects, driven by scripts/routes.mjs's `HASH_REDIRECTS` —
 * the same single-authority pattern App.tsx follows for its 12 path
 * redirects (REDIRECTS), so a hash target is written down exactly once, not
 * restated as a literal here. A URL fragment is never transmitted to a
 * server, so vercel.json structurally cannot carry these two — unlike the
 * other 12 old→new pairs, which get a real 301. Same idiom as
 * SourcesPage.tsx:110-114's `#hash` → scrollIntoView effect, except this one
 * navigates to a different route entirely rather than scrolling within the
 * page. useRouteChrome's rule 2 (scroll-to-top on route change) stands down
 * whenever a hash is present, so there is no fight between that hook and this
 * effect over where the visitor ends up.
 */

import * as React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";
import { useMoneroLive } from "@/data/DataContext";
import { Crumbs } from "@/design/primitives";
import { HASH_REDIRECTS } from "../../scripts/routes.mjs";
import { resolveTab } from "./monero/tabs";
import { MoneroTabs } from "./monero/MoneroTabs";
import { OverviewTab } from "./monero/OverviewTab";
import { OriginTab } from "./monero/OriginTab";
import { TechTab } from "./monero/TechTab";
import { LegalityTab } from "./monero/LegalityTab";
import { VsBitcoinTab } from "./monero/VsBitcoinTab";
import { AttacksTab } from "./monero/AttacksTab";
import { BottomLineTab } from "./monero/BottomLineTab";

export function MoneroPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { tab } = useParams();
  const active = resolveTab(tab);

  // Client-only redirect for the 2 hash rows — see file header. Runs before
  // paint has a chance to settle on the stale "overview" tab underneath.
  React.useEffect(() => {
    if (!hash) return;
    const bare = hash.slice(1);
    const entry = HASH_REDIRECTS.find((h) => h.hash === bare);
    if (entry) navigate(entry.to, { replace: true });
  }, [hash, navigate]);

  // NO scroll handling here — see the same note in EducationPage.tsx. The old
  // `window.scrollTo(0, 0)` was a no-op above 768px (`.art` is
  // `overflow:hidden`; `main.main` is the real scroller), so on desktop a tab
  // switch left you mid-page. routes/useRouteChrome.ts owns it now and resets
  // every scroller a route can have.

  const onChange = (id: string) => navigate(id === "overview" ? "/monero" : "/monero/" + id);

  const tabProps = { data, navigate };
  let content: React.ReactNode;
  switch (active) {
    case "origin":     content = <OriginTab {...tabProps} />; break;
    case "tech":       content = <TechTab {...tabProps} />; break;
    case "legality":   content = <LegalityTab {...tabProps} />; break;
    case "comparison": content = <VsBitcoinTab {...tabProps} />; break;
    case "attacks":    content = <AttacksTab {...tabProps} />; break;
    case "bottomline": content = <BottomLineTab {...tabProps} />; break;
    default:           content = <OverviewTab {...tabProps} />;
  }

  // Width is a property of the active tab, not of the page: Bottom Line is long-form
  // prose so it drops to the reading tier while every other tab stays standard. The
  // container therefore changes width on tab switch — the scroll reset masks that
  // reflow, since the switch repaints from the top either way. That reset used to be
  // the `scrollTo(0, 0)` effect that lived here; it is now useRouteChrome's rule 3,
  // which is the first version of this claim that is actually TRUE on desktop.
  return (
    <PageShell width={active === "bottomline" ? "reading" : "standard"} bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "monero", active]} />
      <MoneroTabs active={active} onChange={onChange} />
      {content}
    </PageShell>
  );
}
