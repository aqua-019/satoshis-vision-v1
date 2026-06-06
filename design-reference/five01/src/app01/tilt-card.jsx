// tilt-card.jsx — mouse-reactive panel wrapper for Markets / Network.
//
// Wraps any child in a div that tilts subtly toward the cursor on hover.
// Effects layered:
//   1. CSS transform: perspective + rotateX/Y (≤6°) tracking cursor offset
//   2. Radial-gradient "shine" overlay that follows the cursor
//   3. Optional pulsing accent border (low-amplitude, slow)
//   4. Float-in transition on first mount (subtle, organic)
//
// Performance: uses CSS variables on the host element so writes are cheap.
// We throttle to requestAnimationFrame; no React re-renders per move.

function TiltCard({ children, intensity = 1, glow = true, pulse = false, style, className, ...rest }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let target = { x: 0.5, y: 0.5 };
    let current = { x: 0.5, y: 0.5 };

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
      if (!raf) raf = requestAnimationFrame(animate);
    };
    const onLeave = () => {
      target.x = 0.5;
      target.y = 0.5;
      if (!raf) raf = requestAnimationFrame(animate);
    };

    const animate = () => {
      // ease toward target
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      const rx = ((0.5 - current.y) * 8 * intensity).toFixed(2);
      const ry = ((current.x - 0.5) * 8 * intensity).toFixed(2);
      el.style.setProperty("--tilt-rx", rx + "deg");
      el.style.setProperty("--tilt-ry", ry + "deg");
      el.style.setProperty("--mx", (current.x * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (current.y * 100).toFixed(1) + "%");

      if (Math.abs(current.x - target.x) > 0.001 || Math.abs(current.y - target.y) > 0.001) {
        raf = requestAnimationFrame(animate);
      } else {
        raf = 0;
      }
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [intensity]);

  return (
    <div ref={ref} className={"tilt-card " + (className || "") + (pulse ? " tilt-pulse" : "")}
      style={{
        transform: "perspective(1100px) rotateX(var(--tilt-rx, 0deg)) rotateY(var(--tilt-ry, 0deg))",
        transformStyle: "preserve-3d",
        transition: "transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)",
        position: "relative",
        ...style,
      }}
      {...rest}
    >
      {glow ? (
        <div className="tilt-shine" style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle 240px at var(--mx, 50%) var(--my, 50%), rgba(255,122,26,0.10), transparent 60%)",
          mixBlendMode: "screen", opacity: 0.85, zIndex: 1,
          borderRadius: "inherit",
        }} />
      ) : null}
      <div style={{ position: "relative", zIndex: 0 }}>{children}</div>
    </div>
  );
}

window.TiltCard = TiltCard;
