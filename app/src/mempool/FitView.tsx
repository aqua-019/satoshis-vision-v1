// mempool/FitView.tsx — wraps a fit-enabled mempool view so it loads scaled to the
// canvas width (P1). It owns the `.mp-fit` ref, runs `useFitToView`, and renders the
// two-layer structure the fit CSS expects:
//
//   .mp-view.mp-view--fit  (overflow:hidden; inline width/height = scaled box)
//     .mp-fit              (transform: scale(scale); origin top-left)
//       <View/>
//
// `scrollRef` is the SAME `.mp-canvas-scroll` node that useDragPan drives, so the
// pan offsets and the fit measurement operate on one element (no duplicate scroll
// container). Classic/Terminal are rendered directly by MempoolPage without this
// wrapper, so their layout is untouched.

import * as React from "react";
import { useFitToView, type FitMode } from "./useFitToView";

export function FitView({
  scrollRef,
  mode,
  children,
}: {
  scrollRef: React.RefObject<HTMLDivElement>;
  mode: FitMode;
  children: React.ReactNode;
}) {
  const fitRef = React.useRef<HTMLDivElement>(null);
  const { scale, width, height } = useFitToView(scrollRef, fitRef, mode);
  return (
    <div className="mp-view mp-view--fit" style={width ? { width, height } : undefined}>
      <div className="mp-fit" ref={fitRef} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
