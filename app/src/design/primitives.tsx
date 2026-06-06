/**
 * design/primitives.tsx — small, framework-free atoms used by every page.
 *
 * Kept tiny and stateless. Style via CSS variables (see styles.css `--tk-*`).
 * Tweaks are NOT in this repo — they live in the design hub.
 */

import * as React from "react";

// ── Stat tile ───────────────────────────────────────────────────

export interface StatProps {
  k: React.ReactNode;
  v: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "acc" | "g" | "p" | "dn";
  big?: boolean;
}

export function Stat({ k, v, sub, tone, big }: StatProps) {
  return (
    <div className="stat" style={big ? { padding: "12px 14px" } : undefined}>
      <div className="lbl">{k}</div>
      <div className={"val" + (tone ? " " + tone : "")} style={big ? { fontSize: 26 } : undefined}>{v}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

// ── Pill ────────────────────────────────────────────────────────

export interface PillProps {
  tone?: "live" | "warn" | "acc";
  dot?: boolean;
  children: React.ReactNode;
}

export function Pill({ tone, dot, children }: PillProps) {
  return (
    <span className={"pill" + (tone ? " " + tone : "")}>
      {dot ? <span className="led pulse" style={{ width: 5, height: 5 }} /> : null}
      {children}
    </span>
  );
}

// ── Panel frame (HUD-bracketed) ─────────────────────────────────

export interface PanelFrameProps {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  scrollable?: string | number;
  style?: React.CSSProperties;
  ticks?: boolean;
}

export function PanelFrame({ title, right, children, scrollable, style, ticks = true }: PanelFrameProps) {
  return (
    <div className="panel" style={style}>
      {ticks ? (<>
        <span className="tick tl" />
        <span className="tick tr" />
        <span className="tick bl" />
        <span className="tick br" />
      </>) : null}
      {title ? (
        <div className="panel-h">
          <div className="l">{typeof title === "string" ? <span>{title}</span> : title}</div>
          <div className="r">{right}</div>
        </div>
      ) : null}
      <div className="panel-b" style={scrollable ? { overflow: "auto", maxHeight: scrollable } : undefined}>
        {children}
      </div>
    </div>
  );
}

// ── Sparkline / MiniBar ─────────────────────────────────────────

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  dots?: boolean;
  area?: number;
}

export function Sparkline({
  data, width = 220, height = 40,
  color = "var(--tk-accent)", fill = true, dots = false, area = 0.25,
}: SparklineProps) {
  if (!data || !data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map<[number, number]>((v, i) => [
    i * step,
    height - ((v - min) / rng) * (height - 4) - 2,
  ]);
  const d = "M" + points.map((p) => p.join(",")).join(" L ");
  const f = d + ` L ${width},${height} L 0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="none"
         style={{ display: "block", maxWidth: width, height: "auto" }}>
      {fill ? <path d={f} fill={color} opacity={area} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      {dots ? points.filter((_, i) => i % 12 === 0).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.2" fill={color} />) : null}
    </svg>
  );
}

export interface MiniBarProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function MiniBar({ data, width = 220, height = 36, color = "var(--tk-accent)" }: MiniBarProps) {
  if (!data || !data.length) return null;
  const max = Math.max(...data) || 1;
  const w = width / data.length;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 2);
        return (
          <rect key={i} x={i * w + 0.5} y={height - h}
            width={Math.max(1, w - 1.5)} height={h}
            fill={color} opacity={0.3 + (v / max) * 0.7} />
        );
      })}
    </svg>
  );
}

// ── Crumbs ──────────────────────────────────────────────────────

export interface CrumbsProps {
  items: string[];
  status?: React.ReactNode;
}

export function Crumbs({ items, status }: CrumbsProps) {
  return (
    <div className="crumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i === items.length - 1 ? <b>{it}</b> : <span>{it}</span>}
          {i < items.length - 1 ? <s>/</s> : null}
        </React.Fragment>
      ))}
      {status ? (
        <span style={{ marginLeft: "auto" }}>
          <span className="led pulse" /> {status}
        </span>
      ) : null}
    </div>
  );
}

// ── Card with HUD corners ───────────────────────────────────────

export interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  accentBorder?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, onClick, accentBorder, style }: CardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className="panel"
      style={{
        cursor: onClick ? "pointer" : "default",
        borderColor: accentBorder ? "var(--tk-accent)" : "var(--rule)",
        transition: "transform 0.18s, border-color 0.18s, box-shadow 0.18s",
        ...style,
      }}
    >
      <span className="tick tl" /><span className="tick tr" />
      <span className="tick bl" /><span className="tick br" />
      {children}
    </div>
  );
}
