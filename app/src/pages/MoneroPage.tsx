/**
 * pages/MoneroPage.tsx — the Monero surface: a tabbed section.
 *
 * Routed via /monero (overview) and /monero/:tab. The active tab is read from
 * the :tab route param, so every tab is bookmarkable and refresh-safe. The
 * breadcrumb's last segment reflects the active tab; the tab bar sits beneath
 * it with an orange active underline. Mirrors five01's /monero/<id> model.
 */

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";
import { useMoneroLive } from "@/data/DataContext";
import { Crumbs } from "@/design/primitives";
import { resolveTab } from "./monero/tabs";
import { MoneroTabs } from "./monero/MoneroTabs";
import { OverviewTab } from "./monero/OverviewTab";
import { OriginTab } from "./monero/OriginTab";
import { TechTab } from "./monero/TechTab";
import { LegalityTab } from "./monero/LegalityTab";
import { MarketsThesisTab } from "./monero/MarketsThesisTab";
import { VsBitcoinTab } from "./monero/VsBitcoinTab";
import { AttacksTab } from "./monero/AttacksTab";
import { BottomLineTab } from "./monero/BottomLineTab";
import { OutlookTab } from "./monero/OutlookTab";

export function MoneroPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const { tab } = useParams();
  const active = resolveTab(tab);

  // Scroll to top whenever the active tab changes.
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [active]);

  const onChange = (id: string) => navigate(id === "overview" ? "/monero" : "/monero/" + id);

  const tabProps = { data, navigate };
  let content: React.ReactNode;
  switch (active) {
    case "origin":     content = <OriginTab {...tabProps} />; break;
    case "tech":       content = <TechTab {...tabProps} />; break;
    case "legality":   content = <LegalityTab {...tabProps} />; break;
    case "markets":    content = <MarketsThesisTab {...tabProps} />; break;
    case "comparison": content = <VsBitcoinTab {...tabProps} />; break;
    case "attacks":    content = <AttacksTab {...tabProps} />; break;
    case "bottomline": content = <BottomLineTab {...tabProps} />; break;
    case "outlook":    content = <OutlookTab {...tabProps} />; break;
    default:           content = <OverviewTab {...tabProps} />;
  }

  // Width is a property of the active tab, not of the page: Bottom Line is long-form
  // prose so it drops to the reading tier while every other tab stays standard. The
  // container therefore changes width on tab switch — the scrollTo(0, 0) effect above
  // already masks that reflow, since the switch repaints from the top either way.
  return (
    <PageShell width={active === "bottomline" ? "reading" : "standard"} bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "monero", active]} />
      <MoneroTabs active={active} onChange={onChange} />
      {content}
    </PageShell>
  );
}
