// sim-fx.jsx — shared FX primitives for high-fidelity protocol stages.
//
// Exports to window:
//   <SvgDefs />            — reusable filter/gradient defs (glow, blur, parallax)
//   <ParticleStream />     — canvas particle layer with depth, trails, glow
//   <Volumetric3D />       — wrapper that adds CSS perspective + drift parallax
//   <GlowOrb cx cy r ...>  — high-fidelity SVG orb with layered radial gradients
//   useFrame()             — rAF-driven sub-frame counter (60fps tick)
//   useMouseParallax(el)   — mouse-relative parallax offset (-1..1 each axis)
//
// These are the building blocks the metaphor stages compose on top of.

/* ── high-precision frame tick (60fps) ────────────────────── */
function useFrame() {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    let raf, last = performance.now();
    const loop = (t) => {
      if (t - last >= 16) { setN((x) => x + 1); last = t; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return n;
}
window.useFrame = useFrame;

/* ── mouse parallax hook ──────────────────────────────────── */
function useMouseParallax(ref, strength = 1) {
  const [p, setP] = React.useState({ x: 0, y: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0, target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width  - 0.5) * 2 * strength;
      target.y = ((e.clientY - r.top)  / r.height - 0.5) * 2 * strength;
      if (!raf) raf = requestAnimationFrame(animate);
    };
    const onLeave = () => { target.x = 0; target.y = 0; if (!raf) raf = requestAnimationFrame(animate); };
    const animate = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      setP({ x: +cur.x.toFixed(3), y: +cur.y.toFixed(3) });
      if (Math.abs(cur.x - target.x) > 0.001 || Math.abs(cur.y - target.y) > 0.001) {
        raf = requestAnimationFrame(animate);
      } else raf = 0;
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); if (raf) cancelAnimationFrame(raf); };
  }, [strength]);
  return p;
}
window.useMouseParallax = useMouseParallax;

/* ── SvgDefs · reusable filters/gradients ─────────────────── */
function SvgDefs({ id = "fx" }) {
  return (
    <defs>
      {/* deep glow — bloom layer */}
      <filter id={id + "-bloom"} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur2" />
        <feMerge>
          <feMergeNode in="blur2" />
          <feMergeNode in="blur1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* soft glow */}
      <filter id={id + "-glow"} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      {/* heavy bloom (volumetric) */}
      <filter id={id + "-bloom-heavy"} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2"  result="b1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="8"  result="b2" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="b3" />
        <feMerge>
          <feMergeNode in="b3" />
          <feMergeNode in="b2" />
          <feMergeNode in="b1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* depth-of-field — distant blur */}
      <filter id={id + "-dof-far"}><feGaussianBlur stdDeviation="1.4" /></filter>

      {/* gradients */}
      <radialGradient id={id + "-flame-core"}>
        <stop offset="0%"   stopColor="#ffe2a8" stopOpacity="1" />
        <stop offset="30%"  stopColor="#ffb978" stopOpacity="0.95" />
        <stop offset="60%"  stopColor="#ff7a1a" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#8a3e07" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id + "-ember"}>
        <stop offset="0%"   stopColor="#ffce8a" stopOpacity="1" />
        <stop offset="60%"  stopColor="#ff7a1a" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#4a2104" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id + "-orb-purple"}>
        <stop offset="0%"   stopColor="#e6c8ff" stopOpacity="1" />
        <stop offset="40%"  stopColor="#b87aff" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#5f2db5" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id + "-orb-cyan"}>
        <stop offset="0%"   stopColor="#d9f4ff" stopOpacity="1" />
        <stop offset="40%"  stopColor="#5ed3f4" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#1a5b75" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id + "-spotlight"}>
        <stop offset="0%"   stopColor="rgba(255,255,255,0.08)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </radialGradient>

      {/* anisotropic light shaft */}
      <linearGradient id={id + "-shaft"} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="rgba(255,200,140,0)" />
        <stop offset="40%"  stopColor="rgba(255,200,140,0.18)" />
        <stop offset="100%" stopColor="rgba(255,200,140,0)" />
      </linearGradient>
    </defs>
  );
}
window.SvgDefs = SvgDefs;

/* ── GlowOrb · layered SVG orb with bloom ─────────────────── */
function GlowOrb({ cx, cy, r = 6, color = "var(--tk-accent)", gradId, pulse = false, key: k }) {
  const id = "fx";
  return (
    <g style={{ transformOrigin: `${cx}px ${cy}px` }}>
      {/* outer halo */}
      <circle cx={cx} cy={cy} r={r * 4.5} fill={`url(#${id}-${gradId || "flame-core"})`} opacity={0.25}>
        {pulse ? <animate attributeName="opacity" values="0.15;0.4;0.15" dur="2.4s" repeatCount="indefinite" /> : null}
      </circle>
      {/* mid glow */}
      <circle cx={cx} cy={cy} r={r * 2.2} fill={`url(#${id}-${gradId || "flame-core"})`} opacity={0.55} />
      {/* hot core */}
      <circle cx={cx} cy={cy} r={r} fill={color}
        style={{ filter: `url(#${id}-bloom)` }}>
        {pulse ? <animate attributeName="r" values={`${r * 0.85};${r * 1.15};${r * 0.85}`} dur="1.6s" repeatCount="indefinite" /> : null}
      </circle>
    </g>
  );
}
window.GlowOrb = GlowOrb;

/* ── ParticleStream · canvas-based particle field with depth ── */
function ParticleStream({
  count = 80,
  width = 1080,
  height = 460,
  color = "rgba(255,178,90,0.85)",
  altColor = "rgba(184,122,255,0.85)",
  altRatio = 0.18,
  speedMul = 1,
  gravity = 0,            // negative = rising
  size = [0.8, 2.4],
  trail = true,
  depth = true,
  spread = "rect",        // rect | bottom-up | radial
  cx, cy, radius,         // for radial
  className,
  style,
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rng = () => Math.random();
    // particles include z (depth, 0..1); 0 = far, 1 = near
    const ps = Array.from({ length: count }).map(() => spawn());
    function spawn() {
      let x, y;
      if (spread === "radial" && radius != null) {
        const a = rng() * Math.PI * 2;
        const r = rng() * radius;
        x = (cx ?? width / 2) + Math.cos(a) * r;
        y = (cy ?? height / 2) + Math.sin(a) * r;
      } else if (spread === "bottom-up") {
        x = rng() * width;
        y = height + rng() * 40;
      } else {
        x = rng() * width;
        y = rng() * height;
      }
      const z = depth ? rng() : 0.5;
      return {
        x, y, z,
        vx: (rng() - 0.5) * 0.3 * speedMul,
        vy: (gravity || (spread === "bottom-up" ? -1 : 0)) * (0.4 + rng() * 0.5) * speedMul,
        r: size[0] + rng() * (size[1] - size[0]),
        a: 0.4 + rng() * 0.6,
        ph: rng() * Math.PI * 2,
        hue: rng() < altRatio ? "alt" : "main",
        life: 0,
        maxLife: 80 + rng() * 220,
      };
    }

    let raf;
    const tick = () => {
      // ghost trail with alpha-clear (poor man's trail accumulation)
      if (trail) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
      } else {
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
      }

      for (const p of ps) {
        p.life++;
        if (p.life > p.maxLife ||
            p.x < -20 || p.x > width + 20 || p.y < -40 || p.y > height + 40) {
          Object.assign(p, spawn(), { life: 0 });
          continue;
        }
        p.x += p.vx; p.y += p.vy;
        p.ph += 0.03;

        const depthScale = depth ? 0.4 + p.z * 0.6 : 1;
        const r = p.r * depthScale;
        const lifeFade = 1 - Math.abs(p.life / p.maxLife - 0.5) * 2;
        const a = p.a * lifeFade * (0.7 + Math.sin(p.ph) * 0.3) * depthScale;

        const c = p.hue === "alt" ? altColor : color;
        // glow halo (depth-aware bloom)
        ctx.globalAlpha = a * 0.25;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * 0.55;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [count, width, height, color, altColor, altRatio, speedMul, gravity, size[0], size[1], trail, depth, spread, cx, cy, radius]);

  return <canvas ref={ref} width={width} height={height}
    className={className}
    style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "screen", ...style }} />;
}
window.ParticleStream = ParticleStream;

/* ── Volumetric3D · 3D perspective wrapper with mouse drift ── */
function Volumetric3D({ children, depth = 800, intensity = 1, style, className }) {
  const ref = React.useRef(null);
  const p = useMouseParallax(ref, intensity * 0.4);
  return (
    <div ref={ref} className={"vol3d " + (className || "")}
      style={{
        position: "relative",
        perspective: depth + "px",
        perspectiveOrigin: `${50 + p.x * 8}% ${50 + p.y * 6}%`,
        transformStyle: "preserve-3d",
        ...style,
      }}>
      <div style={{
        transform: `rotateX(${(-p.y * 4).toFixed(2)}deg) rotateY(${(p.x * 6).toFixed(2)}deg)`,
        transformStyle: "preserve-3d",
        transition: "transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1)",
        width: "100%", height: "100%",
      }}>
        {children}
      </div>
    </div>
  );
}
window.Volumetric3D = Volumetric3D;

/* ── Spotlight · cursor-following soft light ──────────────── */
function Spotlight({ children, color = "rgba(255,122,26,0.08)", radius = 320, className }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      el.style.setProperty("--sy", ((e.clientY - r.top)  / r.height * 100).toFixed(1) + "%");
    };
    const onLeave = () => { el.style.setProperty("--sx", "50%"); el.style.setProperty("--sy", "50%"); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, []);
  return (
    <div ref={ref} className={"spotlight " + (className || "")}
      style={{ position: "relative", "--sx": "50%", "--sy": "50%" }}>
      {children}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(circle ${radius}px at var(--sx) var(--sy), ${color}, transparent 65%)`,
        mixBlendMode: "screen",
      }} />
    </div>
  );
}
window.Spotlight = Spotlight;
