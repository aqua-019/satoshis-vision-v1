// main.jsx — XMRIRISH v5 · 0.1 — root, router-to-page mapping, tweaks
// Pages all read window-registered components; we coordinate them here.

const TWEAK_DEFAULTS_01 = /*EDITMODE-BEGIN*/{
  "accent": "#ff7a1a",
  "bgIntensity": "calm",
  "density": "standard",
  "glow": 1,
  "scan": false,
  "animSpeed": 1,
  "typePair": "serif-mono"
}/*EDITMODE-END*/;

const ACCENT_PALETTE_01 = {
  "#ff7a1a": { glow: "rgba(255,122,26,0.55)", soft: "rgba(255,122,26,0.18)" },
  "#b87aff": { glow: "rgba(184,122,255,0.55)", soft: "rgba(184,122,255,0.18)" },
  "#5ed3f4": { glow: "rgba(94,211,244,0.55)", soft: "rgba(94,211,244,0.18)" },
  "#4ade80": { glow: "rgba(74,222,128,0.55)", soft: "rgba(74,222,128,0.18)" },
};

const TYPE_MAP_01 = {
  "serif-mono": { serif: "Newsreader, serif",   sans: "Geist, system-ui, sans-serif", mono: "JetBrains Mono, monospace" },
  "mono-only":  { serif: "JetBrains Mono, monospace", sans: "JetBrains Mono, monospace", mono: "JetBrains Mono, monospace" },
  "sans-mono":  { serif: "Geist, sans-serif", sans: "Geist, system-ui, sans-serif", mono: "JetBrains Mono, monospace" },
  "editorial":  { serif: "Newsreader, serif", sans: "Newsreader, serif", mono: "JetBrains Mono, monospace" },
};

function applyTweaks01(t) {
  const root = document.documentElement;
  const pal = ACCENT_PALETTE_01[t.accent] || ACCENT_PALETTE_01["#ff7a1a"];
  root.style.setProperty("--tk-accent", t.accent);
  // Inner glow stop is the accent's `soft` (low-alpha) tint, NOT bright
  // cream. This prevents the "white halo" effect when glow >= 2.
  root.style.setProperty("--glow-1", `0 0 ${3 * t.glow}px ${pal.glow}`);
  root.style.setProperty("--glow-2", `0 0 ${7 * t.glow}px ${pal.glow}, 0 0 2px ${pal.soft}`);
  root.style.setProperty("--glow-3", `0 0 ${10 * t.glow}px ${pal.glow}, 0 0 3px ${pal.soft}`);
  root.style.setProperty("--tk-glow", t.glow);
  root.style.setProperty("--tk-anim", t.animSpeed);
  const tm = TYPE_MAP_01[t.typePair] || TYPE_MAP_01["serif-mono"];
  root.style.setProperty("--f-serif", tm.serif);
  root.style.setProperty("--f-sans",  tm.sans);
  root.style.setProperty("--f-mono",  tm.mono);
}

const ROUTE_TABLE = {
  "":          { key: "home",      el: () => window.HomePage },
  "mempool":   { key: "mempool",   el: () => window.MempoolPage },
  "markets":   { key: "markets",   el: () => window.MarketsPage },
  "network":   { key: "network",   el: () => window.NetworkPage },
  "monero":    { key: "monero",    el: () => window.MoneroPage },
  "education": { key: "education", el: () => window.EducationPage },
  "simulate":  { key: "simulate",  el: () => window.SimulatePage },
  "node":      { key: "node",      el: () => window.NodePage },
  "design":    { key: "design",    el: () => window.DesignPage },
};

function App01() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS_01);
  const data = useMoneroLive();
  const route = useHashRoute();

  React.useEffect(() => { applyTweaks01(t); }, [t]);

  const bg = React.useMemo(
    () => ({ intensity: t.bgIntensity, scan: t.scan, animSpeed: t.animSpeed }),
    [t.bgIntensity, t.scan, t.animSpeed]
  );

  // Restore scroll-to-top on route change
  React.useEffect(() => { window.scrollTo(0, 0); }, [route.path]);

  // Route by top-segment so /monero/tech matches the /monero handler.
  const match = ROUTE_TABLE[route.topKey];
  const Page = match ? match.el() : window.NotFoundPage;

  return (
    <>
      <Page
        data={data}
        bg={bg}
        navigate={route.navigate}
        params={route.params}
        hashSegments={route.segments}
      />

      <TweaksPanel title="XMR.IRISH · v5 · 0.1">
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent}
          options={["#ff7a1a", "#b87aff", "#5ed3f4", "#4ade80"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSelect label="Type pairing" value={t.typePair}
          options={[
            { value: "serif-mono", label: "Newsreader serif × Mono" },
            { value: "sans-mono",  label: "Geist sans × Mono" },
            { value: "mono-only",  label: "Mono everywhere" },
            { value: "editorial",  label: "Editorial · serif × mono" },
          ]}
          onChange={(v) => setTweak("typePair", v)} />
        <TweakSlider label="Glow" value={t.glow} min={0} max={4} step={1}
          onChange={(v) => setTweak("glow", v)} />

        <TweakSection label="Atmosphere" />
        <TweakRadio label="Background" value={t.bgIntensity}
          options={["calm", "busy", "chaotic"]}
          onChange={(v) => setTweak("bgIntensity", v)} />
        <TweakToggle label="Scanlines" value={t.scan}
          onChange={(v) => setTweak("scan", v)} />
        <TweakSlider label="Anim speed" value={t.animSpeed} min={0.25} max={2.5} step={0.25}
          onChange={(v) => setTweak("animSpeed", v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App01 />);
