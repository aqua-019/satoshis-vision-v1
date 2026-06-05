// app.jsx — wires up the design canvas, tweaks panel, and data hook.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ff7a1a",
  "bgIntensity": "busy",
  "density": "dense",
  "glow": 2,
  "scan": false,
  "animSpeed": 1,
  "typePair": "serif-mono",
  "focusVariation": "all"
}/*EDITMODE-END*/;

const ACCENT_PALETTE = {
  "#ff7a1a": { name: "Phosphor orange",  glow: "rgba(255,122,26,0.55)", soft: "rgba(255,122,26,0.18)" },
  "#b87aff": { name: "Privacy purple",   glow: "rgba(184,122,255,0.55)", soft: "rgba(184,122,255,0.18)" },
  "#5ed3f4": { name: "Telemetry cyan",   glow: "rgba(94,211,244,0.55)", soft: "rgba(94,211,244,0.18)" },
  "#4ade80": { name: "Acid green",       glow: "rgba(74,222,128,0.55)", soft: "rgba(74,222,128,0.18)" },
};

const TYPE_MAP = {
  "serif-mono":  { serif: "Newsreader, serif",   sans: "Geist, system-ui, sans-serif", mono: "JetBrains Mono, monospace" },
  "mono-only":   { serif: "JetBrains Mono, monospace", sans: "JetBrains Mono, monospace", mono: "JetBrains Mono, monospace" },
  "sans-mono":   { serif: "Geist, sans-serif", sans: "Geist, system-ui, sans-serif", mono: "JetBrains Mono, monospace" },
  "editorial":   { serif: "Newsreader, serif", sans: "Newsreader, serif", mono: "JetBrains Mono, monospace" },
};

function applyTweaks(t) {
  const root = document.documentElement;
  const pal = ACCENT_PALETTE[t.accent] || ACCENT_PALETTE["#ff7a1a"];
  root.style.setProperty("--tk-accent", t.accent);
  root.style.setProperty("--glow-1", `0 0 ${4 * t.glow}px ${pal.glow}`);
  root.style.setProperty("--glow-2", `0 0 ${10 * t.glow}px ${pal.glow}, 0 0 2px ${pal.soft}`);
  root.style.setProperty("--glow-3", `0 0 ${14 * t.glow}px ${pal.glow}, 0 0 4px rgba(255,230,200,1)`);
  root.style.setProperty("--tk-glow", t.glow);
  root.style.setProperty("--tk-anim", t.animSpeed);
  const tm = TYPE_MAP[t.typePair] || TYPE_MAP["serif-mono"];
  root.style.setProperty("--f-serif", tm.serif);
  root.style.setProperty("--f-sans",  tm.sans);
  root.style.setProperty("--f-mono",  tm.mono);
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const data = useMoneroLive();

  React.useEffect(() => { applyTweaks(t); }, [t]);

  const bg = React.useMemo(() => ({ intensity: t.bgIntensity, scan: t.scan, animSpeed: t.animSpeed }), [t.bgIntensity, t.scan, t.animSpeed]);

  const variants = [
    { id: "v1", label: "01 · REACTOR",        sub: "3D iso · hex lattice · ring fan",     component: ReactorView },
    { id: "v2", label: "02 · OPERATIONS BRIDGE", sub: "12-pane mission control",          component: BridgeView },
    { id: "v3", label: "03 · SEDIMENT",       sub: "vertical core-sample tube",           component: SedimentView },
    { id: "v4", label: "04 · CONSTELLATION",  sub: "luminous network sphere",             component: ConstellationView },
    { id: "v5", label: "05 · TERMINAL HUB",   sub: "cli-first · monerod tail",            component: TerminalHubView },
  ];

  const protocols = [
    { id: "p1", label: "P1 · DECOY SELECTION",  component: DecoySelectionView },
    { id: "p2", label: "P2 · DANDELION++",      component: DandelionView },
    { id: "p3", label: "P3 · VIEW TAGS",        component: ViewTagsView },
    { id: "p4", label: "P4 · RINGCT",           component: RingctView },
    { id: "p5", label: "P5 · STEALTH ADDRESS",  component: StealthView },
    { id: "p6", label: "P6 · FCMP++",           component: FcmpView },
  ];

  return (
    <>
      <DesignCanvas>
        <DCSection
          id="mempool-v5"
          title="Mempool Explorer · five01"
          subtitle="5 directions for the flagship surface. Reactor preserves text-density. Click any label to enter focus mode."
        >
          {variants.map((v) => (
            <DCArtboard key={v.id} id={v.id} label={v.label} width={1800} height={1180}>
              <v.component data={data} bg={bg} />
            </DCArtboard>
          ))}
        </DCSection>
        <DCSection
          id="protocols-v5"
          title="Protocol Simulations · five01"
          subtitle="The 6 educational visualizations, reworked with metaphors instead of math-as-diagrams. See METAPHORS.md for more ideas to slot in."
        >
          {protocols.map((p) => (
            <DCArtboard key={p.id} id={p.id} label={p.label} width={1500} height={1100}>
              <p.component data={data} bg={bg} />
            </DCArtboard>
          ))}
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="XMR.IRISH · v5">
        <TweakSection label="Look" />
        <TweakColor label="Accent" value={t.accent}
          options={["#ff7a1a", "#b87aff", "#5ed3f4", "#4ade80"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSelect label="Type pairing" value={t.typePair}
          options={[
            { value: "serif-mono",  label: "Newsreader serif × JetBrains Mono" },
            { value: "sans-mono",   label: "Geist sans × JetBrains Mono" },
            { value: "mono-only",   label: "Mono everywhere" },
            { value: "editorial",   label: "Editorial — serif × mono only" },
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

        <TweakSection label="Density" />
        <TweakRadio label="Density" value={t.density}
          options={["sparse", "standard", "dense", "hyper"]}
          onChange={(v) => setTweak("density", v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
