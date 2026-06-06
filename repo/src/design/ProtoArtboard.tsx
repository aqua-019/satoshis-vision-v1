/**
 * design/ProtoArtboard.tsx — chrome for protocol simulation pages.
 *
 * One big visual on the left, an annotated explainer panel on the right.
 * Used by every file in src/protocols/*.tsx.
 */

import * as React from "react";
import { ArtBackground } from "./ArtBackground";

export interface ProtoBadge {
  label: string;
  tone?: "ready" | "priv" | "acc" | "";
}

export interface ProtoHeaderProps {
  kicker: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  badges?: ProtoBadge[];
  right?: React.ReactNode;
}

export function ProtoHeader({ kicker, title, sub, badges, right }: ProtoHeaderProps) {
  return (
    <div className="proto-head">
      <div className="l">
        <div className="kicker">{kicker}</div>
        <div className="title" dangerouslySetInnerHTML={{ __html: title }} />
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      <div className="r">
        {(badges ?? []).map((b, i) => (
          <span key={i} className={"proto-badge " + (b.tone ?? "")}>{b.label}</span>
        ))}
        {right}
      </div>
    </div>
  );
}

export interface ProtoArtboardProps {
  label?: string;
  kicker: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  badges?: ProtoBadge[];
  right?: React.ReactNode;
  stage: React.ReactNode;
  panel: React.ReactNode;
  scan?: boolean;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

export function ProtoArtboard({
  label, kicker, title, sub, badges, right, stage, panel, scan, bg,
}: ProtoArtboardProps) {
  return (
    <div className={"art proto " + (scan ? "scan-on" : "")} data-screen-label={label}>
      <ArtBackground intensity={bg?.intensity ?? "calm"} scan={scan ?? bg?.scan} />
      <div className="art-stage">
        <ProtoHeader kicker={kicker} title={title} sub={sub} badges={badges} right={right} />
        <div className="proto-body">
          <div className="proto-stage">{stage}</div>
          <aside className="proto-panel">{panel}</aside>
        </div>
      </div>
    </div>
  );
}

export interface ProtoStepProps {
  n: number;
  on?: boolean;
  done?: boolean;
  title: React.ReactNode;
  children?: React.ReactNode;
}

export function ProtoStep({ n, on, done, title, children }: ProtoStepProps) {
  return (
    <div className={"proto-step " + (done ? "done" : on ? "on" : "")} data-n={n}>
      <h5>{title}</h5>
      <p>{children}</p>
    </div>
  );
}
